//
// QuickSearchView.swift
// Nulla Floating Quick Search Spotlight (⌃⌥O)
//

import SwiftUI
import AppKit
import FileProvider

public struct QuickSearchView: View {
    @ObservedObject private var vault = VaultService.shared
    @State private var query = ""
    @State private var selectedIndex = 0
    
    public init() {}
    
    var filteredResults: [VaultNodeItem] {
        if query.isEmpty { return vault.nodes }
        return vault.nodes.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // Search Input Field
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.gray)
                    .font(.system(size: 16))
                
                TextField("Search encrypted Nulla drive...", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundColor(.white)
                
                if !query.isEmpty {
                    Button(action: { query = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.gray)
                    }
                    .buttonStyle(.plain)
                }
                
                Text("ESC to close")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.gray)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.08))
                    .cornerRadius(4)
            }
            .padding(16)
            .background(Color(nsColor: .windowBackgroundColor))
            
            Divider()
                .background(Color.white.opacity(0.1))
            
            // Search Results or Empty State
            if filteredResults.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 24))
                        .foregroundColor(.gray.opacity(0.5))
                    
                    Text(query.isEmpty ? "Vault is empty" : "No matches found")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                    
                    Text("0 bytes allocated on physical disk")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.gray.opacity(0.6))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 36)
            } else {
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(Array(filteredResults.enumerated()), id: \.element.id) { index, item in
                            HStack(spacing: 12) {
                                Image(systemName: item.isFolder ? "folder.fill" : "doc.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(item.isFolder ? .yellow : .white)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.name)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    
                                    HStack(spacing: 6) {
                                        Text("Cloud: \(item.sizeFormatted)")
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundColor(.gray)
                                        
                                        Text("•")
                                            .foregroundColor(.gray)
                                        
                                        Text("Local: \(item.localSizeFormatted)")
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundColor(.green)
                                    }
                                }
                                
                                Spacer()
                                
                                Text("Press ↵ to stream")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.gray.opacity(0.6))
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(selectedIndex == index ? Color.white.opacity(0.1) : Color.clear)
                            .cornerRadius(8)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedIndex = index
                                openItem(item)
                            }
                        }
                    }
                    .padding(8)
                }
                .frame(maxHeight: 280)
            }
        }
        .frame(width: 580)
        .background(Color(nsColor: .windowBackgroundColor))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.15), lineWidth: 1)
        )
        .task {
            await vault.refreshStorage()
        }
    }
    
    private func openItem(_ item: VaultNodeItem) {
        QuickSearchWindowManager.shared.hide()
        Task {
            let domain = NSFileProviderDomain(identifier: NSFileProviderDomainIdentifier("app.nulla.vault"), displayName: "Nulla")
            if let manager = NSFileProviderManager(for: domain) {
                let id = NSFileProviderItemIdentifier(item.id)
                if let url = try? await manager.getUserVisibleURL(for: id) {
                    NSWorkspace.shared.selectFile(url.path, inFileViewerRootedAtPath: "")
                }
            }
        }
    }
}

// MARK: - Floating Window Manager (⌃⌥O)

public final class QuickSearchWindowManager: NSObject {
    public static let shared = QuickSearchWindowManager()
    
    private var window: NSPanel?
    
    private override init() {
        super.init()
    }
    
    public func setup() {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 580, height: 340),
            styleMask: [.nonactivatingPanel, .titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = true
        panel.backgroundColor = .clear
        panel.contentView = NSHostingView(rootView: QuickSearchView())
        panel.center()
        
        self.window = panel
        self.registerGlobalHotkey()
    }
    
    public func toggle() {
        guard let win = window else { return }
        if win.isVisible {
            hide()
        } else {
            show()
        }
    }
    
    public func show() {
        window?.center()
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    public func hide() {
        window?.orderOut(nil)
    }
    
    private func registerGlobalHotkey() {
        NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.modifierFlags.contains([.control, .option]) && event.charactersIgnoringModifiers == "o" {
                self?.toggle()
            }
        }
    }
}
