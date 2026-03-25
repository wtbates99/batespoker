

const nextConfig = {
  // Custom server handles Socket.IO — don't use standalone output
  // as we need to wrap the HTTP server
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs'],
  },
}

export default nextConfig
