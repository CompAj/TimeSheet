import { PrismaPg } from "@prisma/adapter-pg"

function decodeLocalPrismaPostgresUrl(url: string) {
  const apiKey = new URL(url).searchParams.get("api_key")
  if (!apiKey) return url

  try {
    const payload = JSON.parse(Buffer.from(apiKey, "base64url").toString("utf8")) as {
      databaseUrl?: string
    }
    return payload.databaseUrl ?? url
  } catch {
    return url
  }
}

export function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize Prisma.")
  }

  if (url.startsWith("prisma+postgres://")) {
    return decodeLocalPrismaPostgresUrl(url)
  }

  return url
}

export function createPrismaAdapter() {
  return new PrismaPg(resolveDatabaseUrl())
}
