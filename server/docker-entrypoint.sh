#!/bin/sh

# Function to load a secret from a file and export it
load_secret() {
    local secret_name=$1
    local env_var_name=$2
    local secret_file="/run/secrets/${secret_name}"

    if [ -f "$secret_file" ]; then
        export "${env_var_name}=$(cat "$secret_file")"
        echo "Loaded secret ${secret_name} into ${env_var_name}"
    else
        echo "Warning: Secret file ${secret_file} not found"
    fi
}

# Load secrets
load_secret "db_url" "DATABASE_URL"
load_secret "jwt_secret" "JWT_SECRET"
load_secret "admin_secret" "ADMIN_SECRET"

# Execute the CMD passed to the entrypoint
exec "$@"
