#!/bin/bash

echo "Wait start db..."
sleep 20
echo "Running Prisma migrations..."
pnpm prisma migrate deploy

echo "Starting the main application..."
exec "$@"
