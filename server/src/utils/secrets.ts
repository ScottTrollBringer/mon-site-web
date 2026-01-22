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
    // 1. Try to load from Google Cloud Secret Manager if in production
    if (process.env.NODE_ENV === 'production' && envVarName && process.env[envVarName]) {
        try {
            const name = process.env[envVarName]!;
            const [version] = await client.accessSecretVersion({ name });
            const payload = version.payload?.data?.toString();
            if (payload) {
                console.log(`Loaded secret ${secretName} from GCP Secret Manager.`);
                return payload;
            }
        } catch (error) {
            console.error(`Error loading secret ${secretName} from GCP:`, error);
        }
    }

    // 2. Try to load from Docker Secrets (/run/secrets/...)
    const dockerSecretPath = path.join('/run/secrets', secretName);
    if (fs.existsSync(dockerSecretPath)) {
        console.log(`Loaded secret ${secretName} from Docker Secrets.`);
        return fs.readFileSync(dockerSecretPath, 'utf8').trim();
    }

    // 2.5. Try to load from Local Secrets (../secrets/...) for local dev without Docker
    // Try both with and without .txt extension
    const localSecretPossiblePaths = [
        path.join(__dirname, '../../../secrets', secretName),
        path.join(__dirname, '../../../secrets', `${secretName}.txt`)
    ];

    for (const localPath of localSecretPossiblePaths) {
        if (fs.existsSync(localPath)) {
            console.log(`Loaded secret ${secretName} from Local Secrets: ${localPath}`);
            let val = fs.readFileSync(localPath, 'utf8').trim();
            if (secretName === 'db_url' && val.includes('@db:')) {
                console.log('Replacing @db: with @localhost: for local development compatibility.');
                val = val.replace('@db:', '@localhost:');
            }
            return val;
        }
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
