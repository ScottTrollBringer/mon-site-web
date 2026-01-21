import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';

const client = new SecretManagerServiceClient();

/**
 * Loads a secret from Google Cloud Secret Manager or a local file (Docker Secret).
 * @param secretName Name of the secret to load.
 * @param envVarName Name of the environment variable that might contain the GCP secret resource name.
 * @returns The secret value.
 */
export async function getSecret(secretName: string, envVarName?: string): Promise<string> {
    console.log(`[DEBUG] getSecret for "${secretName}". EnvVar: "${envVarName}". NODE_ENV: "${process.env.NODE_ENV}". NameInEnv: "${envVarName ? process.env[envVarName] : 'UNDEFINED'}"`);

    // 1. Try to load from Google Cloud Secret Manager if in production
    if (process.env.NODE_ENV === 'production' && envVarName && process.env[envVarName]) {
        try {
            console.log(`[DEBUG] Attempting to fetch secret from GCP: ${process.env[envVarName]}`);
            const name = process.env[envVarName]!;
            const [version] = await client.accessSecretVersion({ name });
            const payload = version.payload?.data?.toString();
            if (payload) {
                console.log(`Loaded secret ${secretName} from GCP Secret Manager.`);
                return payload;
            } else {
                console.error(`[DEBUG] GCP Secret payload is empty for ${name}`);
            }
        } catch (error) {
            console.error(`Error loading secret ${secretName} from GCP:`, error);
        }
    } else {
        console.log(`[DEBUG] Skipping GCP loading for ${secretName} (Condition met? ${process.env.NODE_ENV === 'production' && envVarName && !!process.env[envVarName]})`);
    }

    // 2. Try to load from Docker Secrets (/run/secrets/...)
    const dockerSecretPath = path.join('/run/secrets', secretName);
    if (fs.existsSync(dockerSecretPath)) {
        console.log(`Loaded secret ${secretName} from Docker Secrets.`);
        return fs.readFileSync(dockerSecretPath, 'utf8').trim();
    }

    // 3. Fallback to environment variable
    const envValue = process.env[secretName.toUpperCase()];
    if (envValue) {
        console.log(`Loaded secret ${secretName} from Environment Variable.`);
        return envValue;
    }

    console.warn(`Secret ${secretName} not found in GCP, Docker, or Environment.`);
    return '';
}
