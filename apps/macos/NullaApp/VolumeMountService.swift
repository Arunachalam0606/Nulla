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
    
    private init() {
        startServer()
        checkMountStatus()
        startMonitoring()
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
            
            nwListener.start(queue: DispatchQueue.global(qos: .userInitiated))
        } catch {
            self.isStartingServer = false
        }
    }
    
    // MARK: - Connection Handler
    
    private func handleConnection(_ connection: NWConnection) {
        connection.stateUpdateHandler = { state in
            switch state {
            case .failed, .cancelled:
                break
            case .waiting(_):
                connection.cancel()
            default:
                break
            }
        }
        connection.start(queue: DispatchQueue.global(qos: .userInitiated))
        
        connection.receive(minimumIncompleteLength: 4, maximumLength: 65536) { [weak self] data, _, _, error in
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
    
    private func processRequest(method: String, path: String, requestString: String, bodyData: Data, connection: NWConnection) {
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
        
        // Root Collection: Calculate 1 TB Quota Metadata (RFC 4331)
        let currentUsageBytes = nodes.reduce(0) { $0 + $1.sizeBytes }
        let oneTerabyte: Int64 = 1_099_511_627_776 // 1 TB in bytes
        let availableBytes = max(0, oneTerabyte - currentUsageBytes)
        
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
            // Append .metadata_never_index
            xml += """
              <D:response>
                <D:href>\(childPrefix).metadata_never_index</D:href>
                <D:propstat>
                  <D:prop>
                    <D:resourcetype/>
                    <D:displayname>.metadata_never_index</D:displayname>
                    <D:getcontentlength>0</D:getcontentlength>
                    <D:getcontenttype>text/plain</D:getcontenttype>
                    <D:getlastmodified>\(rfc1123Date)</D:getlastmodified>
                    <D:creationdate>\(iso8601Date)</D:creationdate>
                    <D:getetag>"nulla-meta-0"</D:getetag>
                  </D:prop>
                  <D:status>HTTP/1.1 200 OK</D:status>
                </D:propstat>
              </D:response>
            """
            
            // Append .VolumeIcon.icns
            let iconURL = resolveBrandedIconURL()
            let iconSize = (try? iconURL?.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 257601
            xml += """
              <D:response>
                <D:href>\(childPrefix).VolumeIcon.icns</D:href>
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
            """
            
            for node in nodes {
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
        
        let streamURL = VaultService.shared.apiBaseURL.appendingPathComponent("api/nodes/\(node.id)/stream")
        var comp = URLComponents(url: streamURL, resolvingAgainstBaseURL: false)!
        comp.queryItems = [URLQueryItem(name: "token", value: token)]
        
        guard let targetURL = comp.url else {
            let err = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            self.sendResponse(connection: connection, text: err)
            return
        }
        
        var upstreamRequest = URLRequest(url: targetURL)
        upstreamRequest.httpMethod = method
        upstreamRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        // Pass Range header if present
        for line in requestString.components(separatedBy: "\r\n") {
            if line.lowercased().hasPrefix("range:") {
                let rangeVal = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                upstreamRequest.addValue(rangeVal, forHTTPHeaderField: "Range")
            }
        }
        
        let task = URLSession.shared.dataTask(with: upstreamRequest) { data, response, error in
            guard let http = response as? HTTPURLResponse, let data = data, error == nil else {
                let err = "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                self.sendResponse(connection: connection, text: err)
                return
            }
            
            var headerLines = ["HTTP/1.1 \(http.statusCode) \(http.statusCode == 206 ? "Partial Content" : "OK")"]
            for (k, v) in http.allHeaderFields {
                let keyStr = "\(k)"
                let valStr = "\(v)"
                if keyStr.lowercased() == "transfer-encoding" || keyStr.lowercased() == "connection" {
                    continue
                }
                headerLines.append("\(keyStr): \(valStr)")
            }
            headerLines.append("Connection: close")
            headerLines.append("\r\n")
            
            var fullPayload = headerLines.joined(separator: "\r\n").data(using: .utf8)!
            if method != "HEAD" {
                fullPayload.append(data)
            }
            
            connection.send(content: fullPayload, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed({ _ in
                connection.cancel()
            }))
        }
        task.resume()
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
    
    // MARK: - Mount & Eject Actions
    
    public func mountVolume() {
        startServer()
        
        Task {
            // Unmount any lingering /Volumes/Nulla or 127.0.0.1 shares
            let unmountNulla = Process()
            unmountNulla.executableURL = URL(fileURLWithPath: "/sbin/umount")
            unmountNulla.arguments = ["-f", "/Volumes/Nulla"]
            try? unmountNulla.run()
            unmountNulla.waitUntilExit()
            
            let unmountIP = Process()
            unmountIP.executableURL = URL(fileURLWithPath: "/sbin/umount")
            unmountIP.arguments = ["-f", "/Volumes/127.0.0.1"]
            try? unmountIP.run()
            unmountIP.waitUntilExit()
            
            let mountPoint = "/Volumes/Nulla"
            try? FileManager.default.createDirectory(atPath: mountPoint, withIntermediateDirectories: true)
            
            // Format URL with volume name and pass "-v Nulla" so macOS NetFS names the volume "Nulla"
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/sbin/mount_webdav")
            process.arguments = ["-v", "Nulla", "http://Nulla@127.0.0.1:\(self.port)/Nulla", mountPoint]
            
            do {
                try process.run()
                process.waitUntilExit()
            } catch {
                print("[VolumeMountService] mount_webdav error: \(error)")
            }
            
            // Fallback to NetFS via osascript if not yet mounted
            let mountedURLs = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: nil, options: []) ?? []
            if !mountedURLs.contains(where: { $0.path == mountPoint }) {
                let osa = Process()
                osa.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
                osa.arguments = ["-e", "mount volume \"http://127.0.0.1:\(self.port)/Nulla\""]
                try? osa.run()
                osa.waitUntilExit()
            }
            
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            
            // Apply Branded Volume Icon (.VolumeIcon.icns) and SetFile attributes
            self.applyVolumeBranding(at: mountPoint)
            
            await MainActor.run {
                self.checkMountStatus()
            }
        }
    }
    
    public func ejectVolume() {
        Task {
            let umountProcess = Process()
            umountProcess.executableURL = URL(fileURLWithPath: "/sbin/umount")
            umountProcess.arguments = ["-f", "/Volumes/Nulla"]
            try? umountProcess.run()
            umountProcess.waitUntilExit()
            
            if FileManager.default.fileExists(atPath: "/Volumes/Nulla") {
                let diskutilProcess = Process()
                diskutilProcess.executableURL = URL(fileURLWithPath: "/usr/sbin/diskutil")
                diskutilProcess.arguments = ["unmount", "force", "/Volumes/Nulla"]
                try? diskutilProcess.run()
                diskutilProcess.waitUntilExit()
            }
            
            let umountIP = Process()
            umountIP.executableURL = URL(fileURLWithPath: "/sbin/umount")
            umountIP.arguments = ["-f", "/Volumes/127.0.0.1"]
            try? umountIP.run()
            umountIP.waitUntilExit()
            
            try? await Task.sleep(nanoseconds: 500_000_000)
            await MainActor.run {
                self.checkMountStatus()
            }
        }
    }
}
