//
// OnboardingView.swift
// Nulla macOS Native Permission Onboarding
// Login Items, File System Extensions, and Finder Integration
//

import SwiftUI
import AppKit
import ServiceManagement
import FileProvider

public struct OnboardingView: View {
    @State private var isLoginItemEnabled: Bool = false
    @State private var isExtensionRegistered: Bool = false
    @State private var isVolumeMounted: Bool = false
    
    public init() {}
    
    public var body: some View {
        VStack(spacing: 24) {
            // Branded Header
            VStack(spacing: 8) {
                Image(systemName: "cylinder.split.1x2.fill")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 48, height: 48)
                    .foregroundColor(.accentColor)
                
                Text("Welcome to Nulla")
                    .font(.title2.bold())
                
                Text("0 bytes on your Mac. Terabytes in the cloud.\nConfigure native macOS permissions for seamless integration.")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
            }
            .padding(.top, 12)
            
            Divider()
            
            // Permissions List
            VStack(spacing: 16) {
                permissionRow(
                    title: "Launch at Login",
                    description: "Keep your zero-knowledge cloud drive mounted in background.",
                    isEnabled: isLoginItemEnabled,
                    actionTitle: isLoginItemEnabled ? "Enabled" : "Enable"
                ) {
                    toggleLoginItem()
                }
                
                permissionRow(
                    title: "File System Extension",
                    description: "Enables macOS Finder badges and native cloud storage syncing.",
                    isEnabled: isExtensionRegistered,
                    actionTitle: "Register Extension"
                ) {
                    registerExtension()
                }
                
                permissionRow(
                    title: "Finder Native Volume",
                    description: "Mounts /Volumes/Nulla with zero physical SSD footprint.",
                    isEnabled: isVolumeMounted,
                    actionTitle: isVolumeMounted ? "Mounted" : "Mount Drive"
                ) {
                    VolumeMountService.shared.mountVolume()
                    checkStatuses()
                }
            }
            .padding(.horizontal, 8)
            
            Divider()
            
            // Footer
            HStack {
                Button("Open System Settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
                        NSWorkspace.shared.open(url)
                    }
                }
                .buttonStyle(.plain)
                .font(.caption)
                .foregroundColor(.secondary)
                
                Spacer()
                
                Button("Done") {
                    NSApp.keyWindow?.close()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
            }
            .padding(.bottom, 8)
        }
        .padding(24)
        .frame(width: 480)
        .onAppear {
            checkStatuses()
        }
    }
    
    @ViewBuilder
    private func permissionRow(
        title: String,
        description: String,
        isEnabled: Bool,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: isEnabled ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isEnabled ? .green : .secondary)
                .font(.title3)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(description)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(actionTitle, action: action)
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(isEnabled && actionTitle == "Enabled")
        }
    }
    
    private func checkStatuses() {
        if #available(macOS 13.0, *) {
            isLoginItemEnabled = SMAppService.mainApp.status == .enabled
        }
        
        let mountedURLs = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: nil, options: []) ?? []
        isVolumeMounted = mountedURLs.contains { $0.path == "/Volumes/Nulla" }
        
        Task {
            let domainIdentifier = NSFileProviderDomainIdentifier("app.nulla.vault")
            let domains = (try? await NSFileProviderManager.domains()) ?? []
            await MainActor.run {
                isExtensionRegistered = domains.contains { $0.identifier == domainIdentifier }
            }
        }
    }
    
    private func toggleLoginItem() {
        if #available(macOS 13.0, *) {
            let service = SMAppService.mainApp
            do {
                if service.status == .enabled {
                    try service.unregister()
                } else {
                    try service.register()
                }
            } catch {
                print("SMAppService error: \(error)")
            }
            checkStatuses()
        }
    }
    
    private func registerExtension() {
        let domain = NSFileProviderDomain(
            identifier: NSFileProviderDomainIdentifier("app.nulla.vault"),
            displayName: "Nulla"
        )
        NSFileProviderManager.add(domain) { _ in
            DispatchQueue.main.async {
                self.checkStatuses()
            }
        }
        
        // Register extension with PlugInKit
        if let extensionURL = Bundle.main.builtInPlugInsURL?.appendingPathComponent("NullaExtension.appex") {
            let proc = Process()
            proc.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
            proc.arguments = ["-a", "-v", extensionURL.path]
            try? proc.run()
        }
    }
}
