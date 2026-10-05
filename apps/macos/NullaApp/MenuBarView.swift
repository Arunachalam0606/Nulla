//
// MenuBarView.swift
// Nulla Menu Bar Companion View
// Drop-Target, Progress Meter, & Volume Status
//

import SwiftUI
import UniformTypeIdentifiers
import FileProvider

public struct MenuBarView: View {
    @ObservedObject private var vault = VaultService.shared
    @ObservedObject private var volumeMount = VolumeMountService.shared
    @State private var isTargetedForDrop = false
    
    public init() {}
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Text("NULLA")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    
                    Text("E2EE")
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(3)
                        .foregroundColor(.gray)
                }
                
                Spacer()
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(volumeMount.isMounted ? Color.green : (vault.isAuthenticated ? Color.blue : Color.yellow))
                        .frame(width: 6, height: 6)
                    
                    Text(volumeMount.isMounted ? "Mounted /Volumes/Nulla" : (vault.isAuthenticated ? "Vault Ready" : "Vault Locked"))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.gray)
                }
            }
            .padding(.bottom, 2)
            
            // Authentication Notice
            if !vault.isAuthenticated {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "lock.shield.fill")
                            .foregroundColor(.yellow)
                            .font(.system(size: 12))
                        
                        Text("Vault is Locked")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white)
                        
                        Spacer()
                        
                        Button(action: openSettings) {
                            Text("Unlock")
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.white)
                                .foregroundColor(.black)
                                .cornerRadius(4)
                        }
                        .buttonStyle(.plain)
                    }
                    
                    Text("Unlock in Settings to mount drive and stream files.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(10)
                .background(Color.yellow.opacity(0.08))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.yellow.opacity(0.2), lineWidth: 1)
                )
            }
            
            // SSD Footprint vs Cloud Allocation Card
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Local SSD Footprint")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(vault.localDiskUsed)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.green)
                }
                
                HStack {
                    Text("Encrypted Cloud Vault")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(vault.cloudStorageUsed)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white)
                }
            }
            .padding(10)
            .background(Color(nsColor: .windowBackgroundColor).opacity(0.5))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            
            // Drag-and-Drop Ingestion Target
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(
                        isTargetedForDrop ? Color.white : Color.white.opacity(0.2),
                        style: StrokeStyle(lineWidth: 1.5, dash: [4])
                    )
                    .background(isTargetedForDrop ? Color.white.opacity(0.05) : Color.clear)
                
                VStack(spacing: 6) {
                    Image(systemName: "arrow.down.doc.fill")
                        .font(.system(size: 20))
                        .foregroundColor(isTargetedForDrop ? .white : .secondary)
                    
                    Text("Drop files to encrypt into Nulla")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white)
                    
                    Text("Allocates 0 bytes on disk")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.gray)
                }
                .padding(.vertical, 18)
            }
            .onDrop(of: [.fileURL], isTargeted: $isTargetedForDrop) { providers in
                handleDroppedFiles(providers: providers)
                return true
            }
            
            // Error Message (if any)
            if let err = vault.errorMessage {
                Text(err)
                    .font(.system(size: 10))
                    .foregroundColor(.red)
                    .lineLimit(2)
            }
            
            // Active Upload Progress Meter
            if vault.isUploading {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(vault.currentUploadFileName)
                            .font(.system(size: 10, weight: .medium))
                            .lineLimit(1)
                            .foregroundColor(.white)
                        
                        Spacer()
                        
                        Text("\(Int(vault.uploadProgress * 100))%")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    
                    ProgressView(value: vault.uploadProgress)
                        .progressViewStyle(LinearProgressViewStyle(tint: .white))
                }
                .padding(8)
                .background(Color.white.opacity(0.04))
                .cornerRadius(6)
            }
            
            Divider()
                .background(Color.white.opacity(0.1))
            
            // Actions
            HStack(spacing: 8) {
                Button(action: openFinderLocation) {
                    Label(volumeMount.isMounted ? "Open /Volumes/Nulla" : "Open Finder", systemImage: "folder")
                        .font(.system(size: 11))
                }
                .buttonStyle(.plain)
                .foregroundColor(.white)
                
                if volumeMount.isMounted {
                    Button(action: { volumeMount.ejectVolume() }) {
                        Image(systemName: "eject.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.white.opacity(0.8))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                    .help("Eject /Volumes/Nulla")
                } else if vault.isAuthenticated {
                    Button(action: { volumeMount.mountVolume() }) {
                        Text("Mount")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.15))
                            .cornerRadius(4)
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)
                    .help("Mount /Volumes/Nulla")
                }
                
                Spacer()
                
                HStack(spacing: 10) {
                    Button(action: openSettings) {
                        Image(systemName: "gearshape")
                            .font(.system(size: 12))
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: openQuickSearch) {
                        Text("⌃⌥O")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.15))
                            .cornerRadius(4)
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)
                    
                    Button("Quit") {
                        NSApplication.shared.terminate(nil)
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                }
            }
        }
        .padding(14)
        .frame(width: 320)
        .background(Color(nsColor: .darkGray).opacity(0.3))
        .task {
            await vault.refreshStorage()
            volumeMount.checkMountStatus()
        }
    }
    
    private func handleDroppedFiles(providers: [NSItemProvider]) {
        for provider in providers {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                var targetURL: URL? = nil
                if let url = item as? URL {
                    targetURL = url
                } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    targetURL = url
                }
                
                if let fileURL = targetURL {
                    Task {
                        do {
                            try await self.vault.uploadFile(url: fileURL)
                        } catch {
                            await MainActor.run {
                                self.vault.errorMessage = error.localizedDescription
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func openFinderLocation() {
        if FileManager.default.fileExists(atPath: "/Volumes/Nulla") {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
            process.arguments = ["/Volumes/Nulla"]
            try? process.run()
            return
        }
        
        // If not mounted yet, mount it now and open
        volumeMount.mountVolume()
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            if FileManager.default.fileExists(atPath: "/Volumes/Nulla") {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
                process.arguments = ["/Volumes/Nulla"]
                try? process.run()
            }
        }
    }
    
    private func openSettings() {
        SettingsWindowManager.shared.show()
    }
    
    private func openQuickSearch() {
        QuickSearchWindowManager.shared.toggle()
    }
}
