//
// NullaApp.swift
// Nulla macOS Native Client
// "0 bytes on your Mac. Terabytes in the cloud."
//

import SwiftUI
import AppKit
import FileProvider
import UniformTypeIdentifiers
import ServiceManagement
import NullaShared

@main
struct NullaApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            SettingsView()
        }
    }
}

import os.log

let appLogger = Logger(subsystem: "app.nulla.macos", category: "App")

// MARK: - App Delegate & Status Bar Controller

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Initialize global floating spotlight search (⌃⌥O)
        QuickSearchWindowManager.shared.setup()
        
        // Setup Menu Bar Status Item with Drag & Drop Ingestion
        setupStatusItem()
        
        // Register Login Items & Background Activity (macOS 13+)
        if #available(macOS 13.0, *) {
            let service = SMAppService.mainApp
            if service.status != .enabled {
                try? service.register()
            }
        }
        
        // Start lightweight WebDAV server and mount /Volumes/Nulla
        VolumeMountService.shared.startServer()
        if VaultService.shared.isAuthenticated {
            VolumeMountService.shared.mountVolume()
        }
        
        // Register and mount Nulla FileProvider domain in Finder
        registerFileProviderDomain()

        // Register Nulla File System Extension (com.apple.fskit.fsmodule)
        registerFileSystemExtension()
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        VolumeMountService.shared.ejectVolume()
    }
    
    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        // Configure popover hosting the MenuBarView
        popover = NSPopover()
        popover.contentSize = NSSize(width: 320, height: 380)
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: MenuBarView())
        
        if let button = statusItem.button {
            button.image = NSImage(
                systemSymbolName: "cylinder.split.1x2.fill",
                accessibilityDescription: "Nulla"
            )
            
            // Register status item button for .fileURL dragged types
            button.registerForDraggedTypes([.fileURL])
            
            // Overlay view to intercept hover draggingEntered and clicks
            let overlay = MenuBarDropOverlayView(frame: button.bounds)
            overlay.autoresizingMask = [.width, .height]
            overlay.appDelegate = self
            button.addSubview(overlay)
        }
    }
    
    private func registerFileProviderDomain() {
        Task {
            appLogger.info("Starting registerFileProviderDomain...")
            let domainIdentifier = NSFileProviderDomainIdentifier("app.nulla.vault")
            let domain = NSFileProviderDomain(
                identifier: domainIdentifier,
                displayName: "Nulla"
            )
            
            do {
                let existingDomains = try await NSFileProviderManager.domains()
                appLogger.info("Existing domains found: \(existingDomains.count)")
                for existing in existingDomains where existing.identifier == domainIdentifier {
                    appLogger.info("Removing stale domain: \(existing.identifier.rawValue)")
                    try? await NSFileProviderManager.remove(existing)
                }
            } catch {
                appLogger.info("Listing domains notice: \(error.localizedDescription)")
            }
            
            do {
                appLogger.info("Registering fresh NSFileProviderDomain: app.nulla.vault...")
                try await NSFileProviderManager.add(domain)
                appLogger.info("Registered NSFileProviderDomain: app.nulla.vault successfully")
            } catch {
                appLogger.info("Domain add result: \(error.localizedDescription)")
            }
            
            guard let manager = NSFileProviderManager(for: domain) else { return }
            do {
                let rootURL = try await manager.getUserVisibleURL(for: .rootContainer)
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
                process.arguments = [rootURL.path]
                try? process.run()
                appLogger.info("Revealed Nulla rootContainer at: \(rootURL.path)")
            } catch {
                // Fallback: Use getpwuid to escape sandbox redirection
                if let pw = getpwuid(getuid()), let home = pw.pointee.pw_dir {
                    let realHome = FileManager.default.string(withFileSystemRepresentation: home, length: Int(strlen(home)))
                    let cloudPath = URL(fileURLWithPath: realHome).appendingPathComponent("Library/CloudStorage/Nulla-app.nulla.vault")
                    if !FileManager.default.fileExists(atPath: cloudPath.path) {
                        let plainPath = URL(fileURLWithPath: realHome).appendingPathComponent("Library/CloudStorage/Nulla")
                        if FileManager.default.fileExists(atPath: plainPath.path) {
                            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: plainPath.path)
                            return
                        }
                    }
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: cloudPath.path)
                }
            }
            
            // Restart Finder so the new CloudStorage domain appears under Locations in the sidebar
            let killFinder = Process()
            killFinder.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
            killFinder.arguments = ["Finder"]
            try? killFinder.run()
            appLogger.info("Finder reloaded for CloudStorage sidebar refresh.")
        }
    }
    
    private func registerFileSystemExtension() {
        Task {
            appLogger.info("Registering File System Extension with PlugInKit...")
            let bundleExtURL = Bundle.main.bundleURL.appendingPathComponent("Contents/Extensions/NullaFS.appex")
            let appExtPath = "/Applications/Nulla.app/Contents/Extensions/NullaFS.appex"
            let targetPath = FileManager.default.fileExists(atPath: bundleExtURL.path) ? bundleExtURL.path : appExtPath
            
            if FileManager.default.fileExists(atPath: targetPath) {
                let addProc = Process()
                addProc.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
                addProc.arguments = ["-a", "-v", targetPath]
                try? addProc.run()
                addProc.waitUntilExit()

                let enableProc = Process()
                enableProc.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
                enableProc.arguments = ["-e", "use", "-i", "app.nulla.macos.fs"]
                try? enableProc.run()
                appLogger.info("Registered and enabled NullaFS extension at \(targetPath).")
            }
        }
    }

    // MARK: - Popover Actions
    
    @objc func togglePopover() {
        guard statusItem.button != nil else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            openPopover()
        }
    }
    
    func openPopover() {
        guard let button = statusItem.button else { return }
        if !popover.isShown {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
    
    func handleDrop(sender: NSDraggingInfo) -> Bool {
        guard let pasteboard = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
              !pasteboard.isEmpty else {
            return false
        }
        
        for fileURL in pasteboard {
            Task {
                do {
                    try await VaultService.shared.uploadFile(url: fileURL)
                } catch {
                    await MainActor.run {
                        VaultService.shared.errorMessage = error.localizedDescription
                    }
                }
            }
        }
        return true
    }
}

// MARK: - Drag Destination Overlay View

final class MenuBarDropOverlayView: NSView {
    weak var appDelegate: AppDelegate?
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.fileURL])
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        registerForDraggedTypes([.fileURL])
    }
    
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        // Open the popover and activate drop zone immediately on hover
        appDelegate?.openPopover()
        return .copy
    }
    
    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        return .copy
    }
    
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        return appDelegate?.handleDrop(sender: sender) ?? false
    }
    
    override func mouseDown(with event: NSEvent) {
        appDelegate?.togglePopover()
    }
}
