import { createRemoteJWKSet, jwtVerify } from "jose";

const TENANT_ID = process.env.MICROSOFT_TENANT_ID || "common";
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;

if (!CLIENT_ID) {
  console.warn("[Microsoft] Falta MICROSOFT_CLIENT_ID en .env");
}

const issuerV2 = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant}/v2.0`;

const jwksUriV2 = (tenant: string) =>
  new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`);

const JWKS = createRemoteJWKSet(jwksUriV2(TENANT_ID));

export type MicrosoftClaims = {
  oid?: string;
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};

export async function verifyMicrosoftIdToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: issuerV2(TENANT_ID),
    audience: CLIENT_ID,
  });

  return payload as unknown as MicrosoftClaims;
}
