#!/bin/bash

# Version variable
VERSION=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Build HeyFun Sandbox Daytona Docker image"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --version VERSION   Specify version (required)"
            echo "  -h, --help              Show help message"
            echo ""
            echo "Examples:"
            echo "  $0 -v 1.0.0             Build with version 1.0.0"
            echo "  $0 --version 2.1.3      Build with version 2.1.3"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if version is specified
if [[ -z "$VERSION" ]]; then
    echo "Error: Version must be specified"
    echo "Usage: $0 -v VERSION"
    echo "Example: $0 -v 1.0.0"
    exit 1
fi

echo "Building version: $VERSION"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker buildx build --platform linux/amd64 -f "$SCRIPT_DIR/Dockerfile" -t iheytang/heyfun-sandbox-daytona:$VERSION "$SCRIPT_DIR"