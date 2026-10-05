//
// SettingsView.swift
// Nulla macOS Client
// Vault Unlock, Authentication, & API Host Configuration
//

import SwiftUI
import AppKit

public struct SettingsView: View {
    @ObservedObject private var vault = VaultService.shared
    
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var apiHost: String = "https://nulla-worker.nulla-vault.workers.dev"
    @State private var showPassword: Bool = false
    @State private var isSubmitting: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successMessage: String? = nil
    @State private var passwordNotice: String? = nil
    
    public init() {}
    
    public var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 10) {
                Image(systemName: "cylinder.split.1x2.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("NULLA VAULT SETTINGS")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    
                    Text("Zero-knowledge client-side encryption")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if vault.isAuthenticated {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 7, height: 7)
                        
                        Text("Unlocked")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(4)
                } else {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 7, height: 7)
                        
                        Text("Locked")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundColor(.red)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(4)
                }
            }
            .padding(16)
            .background(Color(nsColor: .windowBackgroundColor))
            
            Divider()
                .background(Color.white.opacity(0.1))
            
            // Content
            VStack(alignment: .leading, spacing: 16) {
                if vault.isAuthenticated {
                    // Authenticated Vault Status
                    VStack(alignment: .leading, spacing: 12) {
                        Text("ACTIVE VAULT SESSION")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        VStack(spacing: 8) {
                            HStack {
                                Text("Encrypted Cloud Vault")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(vault.cloudStorageUsed)
                                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                    .foregroundColor(.white)
                            }
                            
                            HStack {
                                Text("Local SSD Allocation")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(vault.localDiskUsed)
                                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                    .foregroundColor(.green)
                            }
                            
                            HStack {
                                Text("Connected Host")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(vault.apiBaseURL.absoluteString)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(12)
                        .background(Color.white.opacity(0.04))
                        .cornerRadius(8)
                        
                        HStack(spacing: 12) {
                            Button(action: {
                                Task { await vault.refreshStorage() }
                            }) {
                                Label("Refresh Telemetry", systemImage: "arrow.clockwise")
                                    .font(.system(size: 11))
                            }
                            
                            Spacer()
                            
                            Button(action: {
                                vault.logout()
                            }) {
                                Text("Lock Vault / Sign Out")
                                    .font(.system(size: 11))
                                    .foregroundColor(.red)
                            }
                        }
                    }
                } else {
                    // Login / Vault Unlock Form
                    VStack(alignment: .leading, spacing: 12) {
                        Text("UNLOCK ENCRYPTED VAULT")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.secondary)
                        
                        // API Host Field
                        VStack(alignment: .leading, spacing: 4) {
                            Text("API Host")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.secondary)
                            
                            TextField("https://nulla-worker.nulla-vault.workers.dev", text: $apiHost)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12, design: .monospaced))
                        }
                        
                        // Email Field
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.secondary)
                            
                            TextField("user@nulla.app", text: $email)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 12))
                        }
                        
                        // Password Field
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("Password")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Button(action: generateStrongPassword) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "key.fill")
                                            .font(.system(size: 9))
                                        Text("Generate Strong Password")
                                            .font(.system(size: 10, weight: .medium))
                                    }
                                    .foregroundColor(.green)
                                }
                                .buttonStyle(.plain)
                                
                                Button(action: { showPassword.toggle() }) {
                                    Image(systemName: showPassword ? "eye.slash" : "eye")
                                        .font(.system(size: 11))
                                        .foregroundColor(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                            
                            if showPassword {
                                TextField("Enter password", text: $password)
                                    .textFieldStyle(.roundedBorder)
                                    .font(.system(size: 12))
                            } else {
                                SecureField("Enter password", text: $password)
                                    .textFieldStyle(.roundedBorder)
                                    .font(.system(size: 12))
                            }
                            
                            if let notice = passwordNotice {
                                Text(notice)
                                    .font(.system(size: 10))
                                    .foregroundColor(.orange)
                            }
                        }
                        
                        // Error banner
                        if let err = errorMessage {
                            Text(err)
                                .font(.system(size: 11))
                                .foregroundColor(.red)
                                .padding(8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(6)
                        }
                        
                        // Unlock Button
                        Button(action: handleUnlockVault) {
                            HStack {
                                Spacer()
                                if isSubmitting {
                                    ProgressView()
                                        .controlSize(.small)
                                        .padding(.trailing, 4)
                                    Text("Deriving 256-bit Key & Unlocking...")
                                        .font(.system(size: 12, weight: .semibold))
                                } else {
                                    Text("Unlock Vault")
                                        .font(.system(size: 12, weight: .semibold))
                                }
                                Spacer()
                            }
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.white)
                        .foregroundColor(.black)
                        .disabled(isSubmitting || email.isEmpty || password.isEmpty)
                    }
                }
            }
            .padding(16)
            
            Spacer()
        }
        .frame(width: 420, height: 380)
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear {
            let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos")
            if let savedHost = sharedDefaults?.string(forKey: "nulla_api_host"), !savedHost.isEmpty {
                self.apiHost = savedHost
            } else if let savedHost = UserDefaults.standard.string(forKey: "nulla_api_host"), !savedHost.isEmpty {
                self.apiHost = savedHost
            }
        }
    }
    
    private func generateStrongPassword() {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+"
        var generated = ""
        for _ in 0..<20 {
            if let randomChar = chars.randomElement() {
                generated.append(randomChar)
            }
        }
        self.password = generated
        self.showPassword = true
        self.passwordNotice = "Make sure you save this password in your password manager."
    }
    
    private func handleUnlockVault() {
        guard !email.isEmpty, !password.isEmpty else { return }
        
        isSubmitting = true
        errorMessage = nil
        
        let sharedDefaults = UserDefaults(suiteName: "group.app.nulla.macos")
        sharedDefaults?.set(apiHost, forKey: "nulla_api_host")
        sharedDefaults?.synchronize()
        
        Task {
            do {
                try await vault.login(email: email, password: password, apiHost: apiHost)
                await MainActor.run {
                    self.isSubmitting = false
                    self.password = ""
                }
            } catch {
                await MainActor.run {
                    self.isSubmitting = false
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
}

// MARK: - Settings Window Manager

public final class SettingsWindowManager: NSObject {
    public static let shared = SettingsWindowManager()
    
    private var window: NSWindow?
    
    private override init() {
        super.init()
    }
    
    public func show() {
        if let win = window {
            win.center()
            win.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }
        
        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 380),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        win.title = "Nulla Settings"
        win.titlebarAppearsTransparent = true
        win.isReleasedWhenClosed = false
        win.contentView = NSHostingView(rootView: SettingsView())
        win.center()
        
        self.window = win
        win.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    public func hide() {
        window?.orderOut(nil)
    }
}
