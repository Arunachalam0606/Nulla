//
// VolumeMountService.swift
// Nulla macOS Native Volume Mount Service
// Lightweight Local WebDAV Loopback & /Volumes/Nulla Management with Eject Support
//

import Foundation
import Combine
import Network
import AppKit

public final class VolumeMountService: ObservableObject, @unchecked Sendable {
    public static let shared = VolumeMountService()
    
    @Published public var isMounted: Bool = false
    @Published public var mountStatusMessage: String = "Drive Unmounted"
    
    private let port: UInt16 = 8189
    private var listener: NWListener?
    private var isServerRunning: Bool = false
    private var isStartingServer: Bool = false
    private var monitorTimer: Timer?
    private var lastNodesFetchTime: Date = .distantPast
    private let webdavQueue = DispatchQueue(label: "app.nulla.webdav.io", qos: .userInteractive, attributes: .concurrent)
    
    private init() {
        cleanupStaleShares()
        startServer()
        checkMountStatus()
        startMonitoring()
    }

    public func cleanupStaleShares() {
        Task {
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/localhost"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/localhost"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/127.0.0.1"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/127.0.0.1"])
        }
    }

    // MARK: - Local SSD Stream Cache

    private let cacheDirectory: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dir = caches.appendingPathComponent("app.nulla.macos/stream_cache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private func getCachedFileURL(for node: VaultNodeItem) -> URL {
        let safeName = node.name.replacingOccurrences(of: "/", with: "_")
        return cacheDirectory.appendingPathComponent("\(node.id)_\(safeName)")
    }

    private func isNodeFullyCached(node: VaultNodeItem) -> Bool {
        let fileURL = getCachedFileURL(for: node)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return false }
        let currentSize = (try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        return Int64(currentSize) == node.sizeBytes
    }

    private func serveFromCache(
        fileURL: URL,
        fileSize: Int64,
        rangeHeader: String?,
        method: String,
        connection: NWConnection
    ) {
        guard let fileHandle = try? FileHandle(forReadingFrom: fileURL) else {
            let err = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            sendResponse(connection: connection, text: err)
            return
        }
        defer { try? fileHandle.close() }

        var start: Int64 = 0
        var end: Int64 = fileSize - 1
        var isPartial = false

        if let range = rangeHeader, range.lowercased().hasPrefix("bytes=") {
            let cleanRange = range.dropFirst(6).trimmingCharacters(in: .whitespaces)
            let parts = cleanRange.components(separatedBy: "-")
            if let startInt = Int64(parts[0]) {
                start = startInt
                if parts.count > 1 && !parts[1].isEmpty, let endInt = Int64(parts[1]) {
                    end = min(fileSize - 1, endInt)
                }
                isPartial = true
            }
        }

        let length = max(0, end - start + 1)

        var headerLines: [String] = []
        if isPartial {
            headerLines.append("HTTP/1.1 206 Partial Content")
            headerLines.append("Content-Range: bytes \(start)-\(end)/\(fileSize)")
        } else {
            headerLines.append("HTTP/1.1 200 OK")
        }
        headerLines.append("Content-Type: application/octet-stream")
        headerLines.append("Content-Length: \(length)")
        headerLines.append("Accept-Ranges: bytes")
        headerLines.append("Connection: close")
        headerLines.append("\r\n")

        let headerData = headerLines.joined(separator: "\r\n").data(using: .utf8)!

        if method == "HEAD" {
            connection.send(content: headerData, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
            return
        }

        do {
            try fileHandle.seek(toOffset: UInt64(start))
            let payload = fileHandle.readData(ofLength: Int(length))

            var fullData = headerData
            fullData.append(payload)
            connection.send(content: fullData, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
        } catch {
            connection.cancel()
        }
    }
    
    // MARK: - Mount Status Monitoring
    
    public func startMonitoring() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didMountNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.checkMountStatus()
            }
            
            NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didUnmountNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.checkMountStatus()
            }
            
            self.monitorTimer?.invalidate()
            self.monitorTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
                self?.checkMountStatus()
            }
        }
    }
    
    public func checkMountStatus() {
        let mountedURLs = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: nil, options: []) ?? []
        let isVolumePresent = mountedURLs.contains { $0.path == "/Volumes/Nulla" }
        
        DispatchQueue.main.async {
            if self.isMounted != isVolumePresent {
                self.isMounted = isVolumePresent
                self.mountStatusMessage = isVolumePresent ? "Mounted at /Volumes/Nulla" : "Drive Unmounted"
            }
        }
    }
    
    // MARK: - Real-Time Node Refresh (10s TTL)
    
    public func ensureFreshNodes() {
        let now = Date()
        if now.timeIntervalSince(lastNodesFetchTime) > 10.0 {
            lastNodesFetchTime = now
            Task { @MainActor in
                await VaultService.shared.refreshStorage()
            }
        }
    }
    
    // MARK: - Start WebDAV Server
    
    public func startServer() {
        guard !isServerRunning, !isStartingServer, listener == nil else { return }
        isStartingServer = true
        
        do {
            let parameters = NWParameters.tcp
            parameters.allowLocalEndpointReuse = true
            
            let nwListener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
            self.listener = nwListener
            
            nwListener.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready:
                    self.isServerRunning = true
                    self.isStartingServer = false
                case .failed(_):
                    self.isServerRunning = false
                    self.isStartingServer = false
                    self.listener = nil
                default:
                    break
                }
            }
            
            nwListener.newConnectionHandler = { [weak self] connection in
                self?.handleConnection(connection)
            }
            
            nwListener.start(queue: webdavQueue)
        } catch {
            self.isStartingServer = false
        }
    }
    
    // MARK: - Connection Handler
    
    private func handleConnection(_ connection: NWConnection) {
        let connectionWatchdog = DispatchWorkItem { [weak connection] in
            connection?.cancel()
        }
        webdavQueue.asyncAfter(deadline: .now() + 3.0, execute: connectionWatchdog)

        connection.stateUpdateHandler = { state in
            switch state {
            case .failed, .cancelled:
                connectionWatchdog.cancel()
            case .waiting(_):
                connectionWatchdog.cancel()
                connection.cancel()
            default:
                break
            }
        }
        connection.start(queue: webdavQueue)
        
        connection.receive(minimumIncompleteLength: 4, maximumLength: 65536) { [weak self] data, _, _, error in
            connectionWatchdog.cancel()
            guard let self = self else {
                connection.cancel()
                return
            }
            guard let data = data, error == nil else {
                connection.cancel()
                return
            }
            
            let crlfcrlf = Data([0x0D, 0x0A, 0x0D, 0x0A])
            let headerData: Data
            let bodyData: Data
            if let headerEndRange = data.range(of: crlfcrlf) {
                headerData = data.subdata(in: 0..<headerEndRange.lowerBound)
                bodyData = data.subdata(in: headerEndRange.upperBound..<data.count)
            } else {
                headerData = data
                bodyData = Data()
            }
            
            let requestString = String(data: headerData, encoding: .utf8) ?? String(data: headerData, encoding: .isoLatin1) ?? ""
            let lines = requestString.components(separatedBy: "\r\n")
            guard let requestLine = lines.first else {
                connection.cancel()
                return
            }
            
            let parts = requestLine.components(separatedBy: " ")
            guard parts.count >= 2 else {
                connection.cancel()
                return
            }
            
            let method = parts[0].uppercased()
            let rawPath = parts[1]
            let path = rawPath.removingPercentEncoding ?? rawPath
            
            let logEntry = "[\(Date())] \(method) \(path)\n"
            if let logData = logEntry.data(using: .utf8) {
                if let handle = try? FileHandle(forWritingTo: URL(fileURLWithPath: "/tmp/nulla_webdav.log")) {
                    handle.seekToEndOfFile()
                    handle.write(logData)
                    try? handle.close()
                } else {
                    try? logData.write(to: URL(fileURLWithPath: "/tmp/nulla_webdav.log"))
                }
            }
            try? requestString.write(to: URL(fileURLWithPath: "/tmp/nulla_last_request.txt"), atomically: true, encoding: .utf8)
            
            self.processRequest(method: method, path: path, requestString: requestString, bodyData: bodyData, connection: connection)
        }
    }
    
    // MARK: - Branded Volume Icon & Metadata Helper
    
    private func resolveBrandedIconURL() -> URL? {
        if let bundleURL = Bundle.main.url(forResource: "Nulla", withExtension: "icns") {
            return bundleURL
        }
        let installedAppIcon = URL(fileURLWithPath: "/Applications/Nulla.app/Contents/Resources/Nulla.icns")
        if FileManager.default.fileExists(atPath: installedAppIcon.path) {
            return installedAppIcon
        }
        let workspaceIcon = URL(fileURLWithPath: "/Users/arunachalam/Documents/workspace/mac-storage-cloud/nulla/apps/macos/Resources/Nulla.icns")
        if FileManager.default.fileExists(atPath: workspaceIcon.path) {
            return workspaceIcon
        }
        return nil
    }
    
    private func applyVolumeBranding(at mountPoint: String) {
        guard FileManager.default.fileExists(atPath: mountPoint) else { return }
        
        // 1. Touch .metadata_never_index to prevent Spotlight indexing thrash
        let metadataFile = "\(mountPoint)/.metadata_never_index"
        if !FileManager.default.fileExists(atPath: metadataFile) {
            FileManager.default.createFile(atPath: metadataFile, contents: Data(), attributes: nil)
        }
        
        // 2. Install .VolumeIcon.icns
        guard let iconURL = resolveBrandedIconURL(),
              let iconData = try? Data(contentsOf: iconURL) else { return }
        
        let targetIconPath = "\(mountPoint)/.VolumeIcon.icns"
        try? iconData.write(to: URL(fileURLWithPath: targetIconPath))
        
        // 3. Set custom icon attribute flag 'C' on /Volumes/Nulla
        let setFileC = Process()
        setFileC.executableURL = URL(fileURLWithPath: "/usr/bin/SetFile")
        setFileC.arguments = ["-a", "C", mountPoint]
        try? setFileC.run()
        setFileC.waitUntilExit()
        
        // 4. Hide .VolumeIcon.icns with attribute flag 'V'
        let setFileV = Process()
        setFileV.executableURL = URL(fileURLWithPath: "/usr/bin/SetFile")
        setFileV.arguments = ["-a", "V", targetIconPath]
        try? setFileV.run()
        setFileV.waitUntilExit()
        
        // 5. Register custom icon with Cocoa NSWorkspace
        if let nsImage = NSImage(contentsOf: iconURL) {
            NSWorkspace.shared.setIcon(nsImage, forFile: mountPoint, options: [])
        }
        NSWorkspace.shared.noteFileSystemChanged(mountPoint)
    }

    // MARK: - WebDAV Request Processing
    
    private func isProbePath(_ path: String) -> Bool {
        let lower = path.lowercased()
        return lower.contains("._") ||
               lower.contains(".ds_store") ||
               lower.contains(".trashes") ||
               lower.contains(".spotlight") ||
               lower.contains(".fseventsd") ||
               lower.contains("desktop db") ||
               lower.contains("desktop df") ||
               lower.contains(".temporaryitems")
    }

    private func processRequest(method: String, path: String, requestString: String, bodyData: Data, connection: NWConnection) {
        if isProbePath(path) {
            let notFoundResp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: notFoundResp)
            return
        }

        switch method {
        case "OPTIONS":
            let optionsResp = [
                "HTTP/1.1 200 OK",
                "DAV: 1, 2",
                "MS-Author-Via: DAV",
                "Allow: OPTIONS, GET, HEAD, PROPFIND, PROPPATCH, PUT, DELETE, MKCOL, LOCK, UNLOCK",
                "Accept-Ranges: bytes",
                "Content-Length: 0",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            self.sendResponse(connection: connection, text: optionsResp)
            
        case "PROPFIND":
            self.handlePropfind(path: path, requestString: requestString, connection: connection)
            
        case "GET", "HEAD":
            self.handleGet(path: path, method: method, requestString: requestString, connection: connection)
            
        case "PROPPATCH":
            let propPatchXml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>\(path)</D:href>
                <D:propstat>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>
            """
            self.sendXmlResponse(connection: connection, xml: propPatchXml)
            
        case "LOCK":
            let lockToken = "opaquelocktoken:\(UUID().uuidString)"
            let lockXml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:prop xmlns:D="DAV:">
              <D:lockdiscovery>
                <D:activelock>
                  <D:locktype><D:write/></D:locktype>
                  <D:lockscope><D:exclusive/></D:lockscope>
                  <D:depth>Infinity</D:depth>
                  <D:timeout>Second-3600</D:timeout>
                  <D:locktoken><D:href>\(lockToken)</D:href></D:locktoken>
                </D:activelock>
              </D:lockdiscovery>
            </D:prop>
            """
            let headers = [
                "HTTP/1.1 200 OK",
                "Lock-Token: <\(lockToken)>",
                "Content-Type: text/xml; charset=\"utf-8\"",
                "Content-Length: \(lockXml.utf8.count)",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            self.sendResponse(connection: connection, text: headers + lockXml)
            
        case "UNLOCK":
            self.sendResponse(connection: connection, text: "HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            
        case "PUT":
            let clean = path.replacingOccurrences(of: "/Nulla/", with: "")
                .replacingOccurrences(of: "/Nulla", with: "")
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            
            let baseDir = "/tmp/.nulla_appledouble"
            try? FileManager.default.createDirectory(atPath: baseDir, withIntermediateDirectories: true)
            
            if clean == ".DS_Store" {
                try? bodyData.write(to: URL(fileURLWithPath: "/tmp/.nulla_ds_store"))
            } else if clean.hasPrefix("._") || clean == "._." {
                try? bodyData.write(to: URL(fileURLWithPath: "\(baseDir)/\(clean)"))
            }
            let createdResp = "HTTP/1.1 201 Created\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: createdResp)
            
        case "MKCOL":
            let mkcolResp = "HTTP/1.1 201 Created\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: mkcolResp)
            
        case "DELETE":
            let clean = path.replacingOccurrences(of: "/Nulla/", with: "")
                .replacingOccurrences(of: "/Nulla", with: "")
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let adFile = "/tmp/.nulla_appledouble/\(clean)"
            try? FileManager.default.removeItem(atPath: adFile)
            let delResp = "HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: delResp)
            
        default:
            let methodNotAllowed = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: methodNotAllowed)
        }
    }
    
    // MARK: - Path Encoding & XML Escaping Helpers
    
    private func urlEncodePathSegment(_ string: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "&?#[]@!$'()*+,;=")
        return string.addingPercentEncoding(withAllowedCharacters: allowed) ?? string
    }
    
    private func xmlEscape(_ string: String) -> String {
        return string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }
    
    private func handlePropfind(path: String, requestString: String, connection: NWConnection) {
        // Trigger background refresh if older than 10s
        self.ensureFreshNodes()
        
        let isDepthZero = requestString.contains("Depth: 0") || requestString.contains("depth: 0")
        let nodes = VaultService.shared.nodes
        
        let cleanName = path.replacingOccurrences(of: "/Nulla/", with: "")
            .replacingOccurrences(of: "/Nulla", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        
        let rfc1123Date = "Mon, 05 Oct 2026 10:00:00 GMT"
        let iso8601Date = "2026-10-05T10:00:00Z"
        
        // Handle .VolumeIcon.icns
        if cleanName == ".VolumeIcon.icns" {
            let iconURL = resolveBrandedIconURL()
            let iconSize = (try? iconURL?.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 257601
            let xml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>\(path)</D:href>
                <D:propstat>
                  <D:prop>
                    <D:resourcetype/>
                    <D:displayname>.VolumeIcon.icns</D:displayname>
                    <D:getcontentlength>\(iconSize)</D:getcontentlength>
                    <D:getcontenttype>image/x-icns</D:getcontenttype>
                    <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                    <D:creationdate>\(iso8601Date)</D:creationdate>
                    <D:getetag>"nulla-volicon-\(iconSize)"</D:getetag>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>
            """
            self.sendXmlResponse(connection: connection, xml: xml)
            return
        }
        
        // Handle .metadata_never_index & system suppressors
        if cleanName == ".metadata_never_index" || cleanName == ".metadata_never_index_unless_rootfs" || cleanName == ".ql_disablethumbnails" || cleanName == ".ql_disablecache" {
            let xml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>\(path)</D:href>
                <D:propstat>
                  <D:prop>
                    <D:resourcetype/>
                    <D:displayname>\(cleanName)</D:displayname>
                    <D:getcontentlength>0</D:getcontentlength>
                    <D:getcontenttype>text/plain</D:getcontenttype>
                    <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                    <D:creationdate>\(iso8601Date)</D:creationdate>
                    <D:getetag>"nulla-meta-0"</D:getetag>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>
            """
            self.sendXmlResponse(connection: connection, xml: xml)
            return
        }
        
        // Handle .DS_Store
        if cleanName == ".DS_Store" {
            let dsStoreData = (try? Data(contentsOf: URL(fileURLWithPath: "/tmp/.nulla_ds_store"))) ?? Data()
            let xml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>\(path)</D:href>
                <D:propstat>
                  <D:prop>
                    <D:resourcetype/>
                    <D:displayname>.DS_Store</D:displayname>
                    <D:getcontentlength>\(dsStoreData.count)</D:getcontentlength>
                    <D:getcontenttype>application/octet-stream</D:getcontenttype>
                    <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                    <D:creationdate>\(iso8601Date)</D:creationdate>
                    <D:getetag>"nulla-dsstore-\(dsStoreData.count)"</D:getetag>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>
            """
            self.sendXmlResponse(connection: connection, xml: xml)
            return
        }
        
        // Handle AppleDouble files (._. or ._<file>)
        if cleanName.hasPrefix("._") || cleanName == "._." {
            let adFile = "/tmp/.nulla_appledouble/\(cleanName)"
            if let adData = try? Data(contentsOf: URL(fileURLWithPath: adFile)) {
                let xml = """
                <?xml version="1.0" encoding="utf-8"?>
                <D:multistatus xmlns:D="DAV:">
                  <D:response>
                    <D:href>\(path)</D:href>
                    <D:propstat>
                      <D:prop>
                        <D:resourcetype/>
                        <D:displayname>\(xmlEscape(cleanName))</D:displayname>
                        <D:getcontentlength>\(adData.count)</D:getcontentlength>
                        <D:getcontenttype>application/octet-stream</D:getcontenttype>
                        <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                        <D:creationdate>\(iso8601Date)</D:creationdate>
                        <D:getetag>"nulla-ad-\(adData.count)"</D:getetag>
                      </D:prop>
                      <D:status>HTTP/1.1 200 OK</D:status>
                    </D:propstat>
                  </D:response>
                </D:multistatus>
                """
                self.sendXmlResponse(connection: connection, xml: xml)
                return
            } else {
                let notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                self.sendResponse(connection: connection, text: notFound)
                return
            }
        }
        
        // Handle specific cloud node
        if !cleanName.isEmpty, let singleNode = nodes.first(where: { $0.name == cleanName }) {
            let safeName = urlEncodePathSegment(singleNode.name)
            let href = "/Nulla/\(safeName)"
            let escapedDisplayName = xmlEscape(singleNode.name)
            
            let resourceType = singleNode.isFolder ? "<D:resourcetype><D:collection/></D:resourcetype>" : "<D:resourcetype/>"
            let lengthTag = singleNode.isFolder ? "" : "<D:getcontentlength>\(singleNode.sizeBytes)</D:getcontentlength>"
            let mimeTag = singleNode.isFolder ? "" : "<D:getcontenttype>application/octet-stream</D:getcontenttype>"
            
            let xml = """
            <?xml version="1.0" encoding="utf-8"?>
            <D:multistatus xmlns:D="DAV:">
              <D:response>
                <D:href>\(href)\(singleNode.isFolder ? "/" : "")</D:href>
                <D:propstat>
                  <D:prop>
                    \(resourceType)
                    <D:displayname>\(escapedDisplayName)</D:displayname>
                    \(lengthTag)
                    \(mimeTag)
                    <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                    <D:creationdate>\(iso8601Date)</D:creationdate>
                    <D:getetag>"nulla-\(singleNode.id)"</D:getetag>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            </D:multistatus>
            """
            self.sendXmlResponse(connection: connection, xml: xml)
            return
        }
        
        // If cleanName is NOT empty and didn't match any node or system file, return 404
        if !cleanName.isEmpty {
            let notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: notFound)
            return
        }
        
        // Root Collection: Calculate Live User Quota Metadata (RFC 4331)
        let userQuota = VaultService.shared.userStorageQuotaBytes > 0 ? VaultService.shared.userStorageQuotaBytes : 5_368_709_120
        let currentUsageBytes = VaultService.shared.userStorageUsedBytes > 0 ? VaultService.shared.userStorageUsedBytes : nodes.reduce(0) { $0 + $1.sizeBytes }
        let availableBytes = max(0, userQuota - currentUsageBytes)
        
        let normalizedPath = path.hasSuffix("/") ? String(path.dropLast()) : path
        let baseHref = normalizedPath.hasPrefix("/Nulla") ? "\(normalizedPath)/" : "/Nulla/"
        let childPrefix = "/Nulla/"
        
        // Return folder collection with explicit displayname "Nulla" and 1 TB quota
        var xml = """
        <?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>\(baseHref)</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype><D:collection/></D:resourcetype>
                <D:displayname>Nulla</D:displayname>
                <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                <D:creationdate>\(iso8601Date)</D:creationdate>
                <D:quota-available-bytes>\(availableBytes)</D:quota-available-bytes>
                <D:quota-used-bytes>\(currentUsageBytes)</D:quota-used-bytes>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        """
        
        // Only append children if Depth != 0
        if !isDepthZero {
            for node in nodes {
                // Filter out any dotfiles or internal metadata files from Finder listings
                if node.name.hasPrefix(".") {
                    continue
                }

                let safeName = urlEncodePathSegment(node.name)
                let href = "\(childPrefix)\(safeName)"
                let escapedDisplayName = xmlEscape(node.name)
                
                if node.isFolder {
                    xml += """
                      <D:response>
                        <D:href>\(href)/</D:href>
                        <D:propstat>
                          <D:prop>
                            <D:resourcetype><D:collection/></D:resourcetype>
                            <D:displayname>\(escapedDisplayName)</D:displayname>
                            <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                            <D:creationdate>\(iso8601Date)</D:creationdate>
                          </D:prop>
                          <D:status>HTTP/1.1 200 OK</D:status>
                        </D:propstat>
                      </D:response>
                    """
                } else {
                    xml += """
                      <D:response>
                        <D:href>\(href)</D:href>
                        <D:propstat>
                          <D:prop>
                            <D:resourcetype/>
                            <D:displayname>\(escapedDisplayName)</D:displayname>
                            <D:getcontentlength>\(node.sizeBytes)</D:getcontentlength>
                            <D:getcontenttype>application/octet-stream</D:getcontenttype>
                            <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                            <D:creationdate>\(iso8601Date)</D:creationdate>
                            <D:getetag>"nulla-\(node.id)"</D:getetag>
                          </D:prop>
                          <D:status>HTTP/1.1 200 OK</D:status>
                        </D:propstat>
                      </D:response>
                    """
                }
            }
        }
        
        xml += "\n</D:multistatus>"
        self.sendXmlResponse(connection: connection, xml: xml)
    }
    
    private func sendXmlResponse(connection: NWConnection, xml: String) {
        guard let xmlData = xml.data(using: .utf8) else {
            connection.cancel()
            return
        }
        
        let headers = [
            "HTTP/1.1 207 Multi-Status",
            "Content-Type: text/xml; charset=\"utf-8\"",
            "Content-Length: \(xmlData.count)",
            "Connection: close",
            "\r\n"
        ].joined(separator: "\r\n")
        
        var fullData = headers.data(using: .utf8)!
        fullData.append(xmlData)
        
        connection.send(content: fullData, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
            connection.cancel()
        }))
    }
    
    private func handleGet(path: String, method: String, requestString: String, connection: NWConnection) {
        let cleanName = path.replacingOccurrences(of: "/Nulla/", with: "")
            .replacingOccurrences(of: "/Nulla", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        
        // 1. Serve .VolumeIcon.icns
        if cleanName == ".VolumeIcon.icns" {
            if let iconURL = resolveBrandedIconURL(), let iconData = try? Data(contentsOf: iconURL) {
                let headers = [
                    "HTTP/1.1 200 OK",
                    "Content-Type: image/x-icns",
                    "Content-Length: \(iconData.count)",
                    "Connection: close",
                    "\r\n"
                ].joined(separator: "\r\n")
                var fullPayload = headers.data(using: .utf8)!
                if method != "HEAD" {
                    fullPayload.append(iconData)
                }
                connection.send(content: fullPayload, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
                return
            }
        }
        
        // 2. Serve System & Indexing suppressors
        if cleanName == ".metadata_never_index" || cleanName == ".metadata_never_index_unless_rootfs" || cleanName == ".ql_disablethumbnails" || cleanName == ".ql_disablecache" {
            let headers = [
                "HTTP/1.1 200 OK",
                "Content-Type: text/plain",
                "Content-Length: 0",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            connection.send(content: headers.data(using: .utf8)!, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
            return
        }
        
        // 3. Serve .DS_Store
        if cleanName == ".DS_Store" {
            let dsStoreData = (try? Data(contentsOf: URL(fileURLWithPath: "/tmp/.nulla_ds_store"))) ?? Data()
            let headers = [
                "HTTP/1.1 200 OK",
                "Content-Type: application/octet-stream",
                "Content-Length: \(dsStoreData.count)",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            var fullPayload = headers.data(using: .utf8)!
            if method != "HEAD" {
                fullPayload.append(dsStoreData)
            }
            connection.send(content: fullPayload, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
            return
        }
        
        // 4. Serve AppleDouble files (._. or ._<file>)
        if cleanName.hasPrefix("._") || cleanName == "._." {
            let adFile = "/tmp/.nulla_appledouble/\(cleanName)"
            if let adData = try? Data(contentsOf: URL(fileURLWithPath: adFile)) {
                let headers = [
                    "HTTP/1.1 200 OK",
                    "Content-Type: application/octet-stream",
                    "Content-Length: \(adData.count)",
                    "Connection: close",
                    "\r\n"
                ].joined(separator: "\r\n")
                var fullPayload = headers.data(using: .utf8)!
                if method != "HEAD" {
                    fullPayload.append(adData)
                }
                connection.send(content: fullPayload, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
                return
            } else {
                let notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                self.sendResponse(connection: connection, text: notFound)
                return
            }
        }
        
        // 5. Fast HEAD for cloud nodes (Instantaneous stat without remote network roundtrip)
        if method == "HEAD", let node = VaultService.shared.nodes.first(where: { $0.name == cleanName }) {
            let headers = [
                "HTTP/1.1 200 OK",
                "Content-Type: application/octet-stream",
                "Content-Length: \(node.sizeBytes)",
                "Accept-Ranges: bytes",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            self.sendResponse(connection: connection, text: headers)
            return
        }
        
        // 6. Serve collection root
        if cleanName.isEmpty {
            let html = "<!DOCTYPE html><html><head><title>Nulla</title></head><body><h1>Nulla Cloud Vault</h1></body></html>"
            let htmlData = html.data(using: .utf8)!
            let headers = [
                "HTTP/1.1 200 OK",
                "Content-Type: text/html; charset=\"utf-8\"",
                "Content-Length: \(htmlData.count)",
                "Connection: close",
                "\r\n"
            ].joined(separator: "\r\n")
            var fullPayload = headers.data(using: .utf8)!
            if method != "HEAD" {
                fullPayload.append(htmlData)
            }
            connection.send(content: fullPayload, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
            return
        }
        
        guard let node = VaultService.shared.nodes.first(where: { $0.name == cleanName }),
              let token = VaultService.shared.getAuthToken() else {
            let notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: notFound)
            return
        }

        // Extract Range header if present
        var rangeHeader: String? = nil
        for line in requestString.components(separatedBy: "\r\n") {
            if line.lowercased().hasPrefix("range:") {
                rangeHeader = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                break
            }
        }

        // Instant SSD cache read-through check (<0.01s)
        let cachedURL = getCachedFileURL(for: node)
        if isNodeFullyCached(node: node) {
            serveFromCache(
                fileURL: cachedURL,
                fileSize: node.sizeBytes,
                rangeHeader: rangeHeader,
                method: method,
                connection: connection
            )
            return
        }

        let streamURL = VaultService.shared.apiBaseURL.appendingPathComponent("api/nodes/\(node.id)/stream")
        var comp = URLComponents(url: streamURL, resolvingAgainstBaseURL: false)!
        comp.queryItems = [URLQueryItem(name: "token", value: token)]

        guard let targetURL = comp.url else {
            let err = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: err)
            return
        }

        // Trigger background full file download to local SSD cache
        FileDownloadCoordinator.shared.startBackgroundCache(
            nodeId: node.id,
            targetURL: targetURL,
            destinationURL: cachedURL
        )

        var upstreamRequest = URLRequest(url: targetURL)
        upstreamRequest.httpMethod = method
        upstreamRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        if let rangeVal = rangeHeader {
            upstreamRequest.addValue(rangeVal, forHTTPHeaderField: "Range")
        }

        let streamer = WebDAVStreamer(connection: connection, method: method)
        streamer.start(request: upstreamRequest)
    }

    private func sendResponse(connection: NWConnection, text: String) {
        guard let data = text.data(using: .utf8) else {
            connection.cancel()
            return
        }
        connection.send(content: data, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
            connection.cancel()
        }))
    }
}

// MARK: - Background File Download Coordinator for SSD Stream Cache

private final class FileDownloadCoordinator: @unchecked Sendable {
    static let shared = FileDownloadCoordinator()
    private var activeDownloads = Set<String>()
    private let lock = NSLock()

    func startBackgroundCache(nodeId: String, targetURL: URL, destinationURL: URL) {
        lock.lock()
        if activeDownloads.contains(nodeId) || FileManager.default.fileExists(atPath: destinationURL.path) {
            lock.unlock()
            return
        }
        activeDownloads.insert(nodeId)
        lock.unlock()

        let tempDestination = destinationURL.appendingPathExtension("download")
        let task = URLSession.shared.downloadTask(with: targetURL) { [weak self] tempLocalURL, response, error in
            defer {
                self?.lock.lock()
                self?.activeDownloads.remove(nodeId)
                self?.lock.unlock()
            }
            guard let tempLocalURL = tempLocalURL, error == nil else { return }
            try? FileManager.default.removeItem(at: tempDestination)
            try? FileManager.default.moveItem(at: tempLocalURL, to: tempDestination)
            try? FileManager.default.removeItem(at: destinationURL)
            try? FileManager.default.moveItem(at: tempDestination, to: destinationURL)
        }
        task.resume()
    }
}

// MARK: - Delegate-Driven Non-Blocking WebDAV Socket Streamer

private final class WebDAVStreamer: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let connection: NWConnection
    private let method: String
    private var session: URLSession?
    private var selfRetain: WebDAVStreamer?
    private var firstByteWatchdog: DispatchWorkItem?

    init(connection: NWConnection, method: String) {
        self.connection = connection
        self.method = method
        super.init()
        self.selfRetain = self
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    func start(request: URLRequest) {
        let watchdog = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            let timeoutResp = "HTTP/1.1 504 Gateway Timeout\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            if let data = timeoutResp.data(using: .utf8) {
                self.connection.send(content: data, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ [weak self] _ in
                    self?.connection.cancel()
                    self?.cleanup()
                }))
            } else {
                self.connection.cancel()
                self.cleanup()
            }
        }
        self.firstByteWatchdog = watchdog
        DispatchQueue.global().asyncAfter(deadline: .now() + 2.5, execute: watchdog)

        let task = session?.dataTask(with: request)
        task?.resume()
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil

        guard let http = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            connection.cancel()
            cleanup()
            return
        }

        var headerLines = ["HTTP/1.1 \(http.statusCode) \(http.statusCode == 206 ? "Partial Content" : "OK")"]
        for (k, v) in http.allHeaderFields {
            let keyStr = "\(k)"
            let lower = keyStr.lowercased()
            if lower == "transfer-encoding" || lower == "connection" {
                continue
            }
            headerLines.append("\(keyStr): \(v)")
        }
        headerLines.append("Connection: close")
        headerLines.append("\r\n")

        let headerData = headerLines.joined(separator: "\r\n").data(using: .utf8)!

        if method == "HEAD" {
            connection.send(content: headerData, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ [weak self] _ in
                self?.connection.cancel()
                self?.cleanup()
            }))
            completionHandler(.cancel)
            return
        }

        connection.send(content: headerData, isComplete: false, completion: .idempotent)
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil
        // Stream chunks directly from R2 to the socket without loading multi-GB files into RAM
        connection.send(content: data, isComplete: false, completion: .idempotent)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil
        connection.send(content: Data(), contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ [weak self] _ in
            self?.connection.cancel()
            self?.cleanup()
        }))
    }

    private func cleanup() {
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil
        session?.invalidateAndCancel()
        session = nil
        selfRetain = nil
    }
}

extension VolumeMountService {

    // MARK: - Asynchronous Subprocess Execution Helper (Zero VFS Main Runloop Hang)

    private final class ProcessContinuationState: @unchecked Sendable {
        private var hasResumed = false
        private let lock = NSLock()

        func resumeOnce(continuation: CheckedContinuation<Int32, Never>, status: Int32, cancelProcess: Process? = nil) {
            lock.lock()
            defer { lock.unlock() }
            if !hasResumed {
                hasResumed = true
                if let proc = cancelProcess, proc.isRunning {
                    proc.terminate()
                }
                continuation.resume(returning: status)
            }
        }
    }

    @discardableResult
    private func runProcessAsync(executable: String, arguments: [String], timeoutSeconds: Double = 3.0) async -> Int32 {
        await withCheckedContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
            
            let state = ProcessContinuationState()
            
            let watchdog = DispatchWorkItem { [weak process] in
                state.resumeOnce(continuation: continuation, status: -1, cancelProcess: process)
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeoutSeconds, execute: watchdog)
            
            process.terminationHandler = { proc in
                watchdog.cancel()
                state.resumeOnce(continuation: continuation, status: proc.terminationStatus)
            }
            
            do {
                try process.run()
            } catch {
                watchdog.cancel()
                state.resumeOnce(continuation: continuation, status: -1)
            }
        }
    }
    
    // MARK: - Mount & Eject Actions
    
    public func mountVolume() {
        startServer()
        
        Task {
            // Force unmount any lingering /Volumes/localhost, /Volumes/127.0.0.1, or /Volumes/Nulla shares asynchronously
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/localhost"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/localhost"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/127.0.0.1"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/127.0.0.1"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/Nulla"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/Nulla"])
            
            let mountPoint = "/Volumes/Nulla"
            try? FileManager.default.createDirectory(atPath: mountPoint, withIntermediateDirectories: true)
            
            // Mount exclusively via mount_webdav directly to /Volumes/Nulla
            // Do NOT use AppleScript "mount volume" which creates a duplicate "localhost" entry in Finder sidebar
            await runProcessAsync(
                executable: "/sbin/mount_webdav",
                arguments: ["-s", "-v", "Nulla", "http://guest:@127.0.0.1:\(self.port)/Nulla", mountPoint],
                timeoutSeconds: 4.0
            )
            
            try? await Task.sleep(nanoseconds: 800_000_000)

            // If macOS NetFS defaulted to /Volumes/127.0.0.1, rename via diskutil
            if FileManager.default.fileExists(atPath: "/Volumes/127.0.0.1") {
                await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["rename", "/Volumes/127.0.0.1", "Nulla"])
            }
            
            // Apply Branded Volume Icon (.VolumeIcon.icns) and SetFile attributes
            self.applyVolumeBranding(at: mountPoint)
            
            await MainActor.run {
                self.checkMountStatus()
            }
        }
    }
    
    public func ejectVolume() {
        Task {
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/Nulla"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/Nulla"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/localhost"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/localhost"])
            await runProcessAsync(executable: "/sbin/umount", arguments: ["-f", "/Volumes/127.0.0.1"])
            await runProcessAsync(executable: "/usr/sbin/diskutil", arguments: ["unmount", "force", "/Volumes/127.0.0.1"])
            
            try? await Task.sleep(nanoseconds: 500_000_000)
            await MainActor.run {
                self.checkMountStatus()
            }
        }
    }
}
