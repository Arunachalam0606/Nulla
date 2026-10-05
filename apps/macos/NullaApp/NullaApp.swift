//
// NullaApp.swift
// Nulla macOS Native Client
// "0 bytes on your Mac. Terabytes in the cloud."
//

import SwiftUI
import AppKit
import FileProvider
import UniformTypeIdentifiers
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
        
        // Register and mount Nulla FileProvider domain in Finder
        registerFileProviderDomain()
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
                appLogger.info("Ensuring NSFileProviderDomain: app.nulla.vault...")
                do {
                    try await NSFileProviderManager.add(domain)
                    appLogger.info("Registered NSFileProviderDomain: app.nulla.vault")
                } catch {
                    appLogger.info("Domain add result (may already exist): \(error.localizedDescription)")
                }
                
                if let manager = NSFileProviderManager(for: domain) {
                    let rootURL = try await manager.getUserVisibleURL(for: .rootContainer)
                    try? FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: rootURL.path)
                    appLogger.info("Revealed Nulla root container in Finder at: \(rootURL.path)")
                }
                
                // Restart Finder so the new CloudStorage domain appears under Locations in the sidebar
                let killFinder = Process()
                killFinder.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
                killFinder.arguments = ["Finder"]
                try? killFinder.run()
                appLogger.info("Finder reloaded for CloudStorage sidebar refresh.")
            } catch {
                appLogger.error("NSFileProviderManager setup error: \(error.localizedDescription) (Error: \(error))")
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
