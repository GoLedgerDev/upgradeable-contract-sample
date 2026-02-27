# Foundry Makefile for building, deploying, and managing the project
-include .env

PRIVATE_KEY := $(PRIVATE_KEY)
RPC_URL := $(RPC_URL)


.PHONY: all test clean deploy anvil help install snapshot format lint clean-modules remove-all install-deps update build test-v test-summary coverage gas deploy-anvil script compile-go

# Default target
all: clean build

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Help command
help:
	@echo "$(GREEN)Available commands:$(NC)"
	@echo "$(YELLOW)Building:$(NC)"
	@echo "  build          - Build the contracts"
	@echo "  clean          - Remove cache and out directory"
	@echo "  clean-modules  - Remove lib directory (safe)"
	@echo "  remove-all     - Remove ALL modules (dangerous)"
	@echo "  install        - Install dependencies"
	@echo "  install-deps   - Install common dependencies"
	@echo "  update         - Update dependencies"
	@echo ""
	@echo "$(YELLOW)Testing:$(NC)"
	@echo "  test           - Run tests"
	@echo "  test-v         - Run tests with verbose output"
	@echo "  test-summary   - Run tests with summary"
	@echo "  coverage       - Generate coverage report"
	@echo "  gas            - Generate gas report"
	@echo "  snapshot       - Create gas snapshot"
	@echo ""
	@echo "$(YELLOW)Deployment:$(NC)"
	@echo "  deploy-anvil   - Deploy to local Anvil"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  anvil          - Start local Anvil node"
	@echo "  format         - Format code"
	@echo "  lint           - Lint code"

# Clean up
clean:
	@echo "$(YELLOW)Cleaning cache and artifacts...$(NC)"
	forge clean

clean-modules:
	@echo "$(YELLOW)Removing lib directory (keeping .gitmodules)...$(NC)"
	rm -rf lib/

remove-all:
	@echo "$(RED)⚠️  WARNING: This will remove ALL dependencies and git submodule info!$(NC)"
	@echo "$(RED)You'll need to reinstall dependencies manually. Continue? (y/N)$(NC)"
	@read -r REPLY; if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
		rm -rf .gitmodules && rm -rf .git/modules/* && rm -rf lib && touch .gitmodules && git add . && git commit -m "removed all modules"; \
		echo "$(YELLOW)All modules removed. Use 'make install-deps' to reinstall common dependencies.$(NC)"; \
	else \
		echo "$(YELLOW)Operation cancelled.$(NC)"; \
	fi

# Dependencies
install:
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	forge install

update:
	@echo "$(YELLOW)Updating dependencies...$(NC)"
	forge update

# Build
build:
	@echo "$(YELLOW)Building contracts...$(NC)"
	forge build

compile-go:
	@echo "$(YELLOW)Compiling Go contract...$(NC)"
	@if [ -z "$(word 2,$(MAKECMDGOALS))" ]; then \
		echo "$(RED)Error: Contract path is required. Usage: make compile-go ContractPath$(NC)"; \
		exit 1; \
	fi
	@CONTRACT_NAME=$(basename $(notdir $(word 2,$(MAKECMDGOALS:.sol=)))); \
	ARTIFACTS_DIR=./artifacts/$$CONTRACT_NAME; \
	echo "$(YELLOW)Preparing artifacts directory: $$ARTIFACTS_DIR$(NC)"; \
	if [ -d "$$ARTIFACTS_DIR" ]; then \
		echo "$(YELLOW)Cleaning existing artifacts...$(NC)"; \
		rm -rf $$ARTIFACTS_DIR/*; \
	else \
		mkdir -p $$ARTIFACTS_DIR; \
	fi; \
	solc --abi --bin $(word 2,$(MAKECMDGOALS)) -o $$ARTIFACTS_DIR; \
	abigen --abi=$$ARTIFACTS_DIR/$(notdir $(word 2,$(MAKECMDGOALS:.sol=.abi))) --bin=$$ARTIFACTS_DIR/$(notdir $(word 2,$(MAKECMDGOALS:.sol=.bin))) --pkg=$$CONTRACT_NAME --out=./go/$$CONTRACT_NAME.go

# Testing
test:
	@echo "$(YELLOW)Running tests...$(NC)"
	forge test

test-v:
	@echo "$(YELLOW)Running tests with verbose output...$(NC)"
	forge test -vvv

test-summary:
	@echo "$(YELLOW)Running tests with summary...$(NC)"
	forge test --summary

coverage:
	@echo "$(YELLOW)Generating coverage report...$(NC)"
	forge coverage

gas:
	@echo "$(YELLOW)Generating gas report...$(NC)"
	forge test --gas-report

snapshot:
	@echo "$(YELLOW)Creating gas snapshot...$(NC)"
	forge snapshot

# Local development
anvil:
	@echo "$(YELLOW)Starting Anvil local node...$(NC)"
	anvil -m 'test test test test test test test test test test test junk' --steps-tracing --block-time 1

# Deployment targets
deploy:
	@echo "$(GREEN)Deploying to local Anvil...$(NC)"
	@if [ -z "$(word 2,$(MAKECMDGOALS))" ]; then \
		echo "$(RED)Error: Contract path is required. Usage: make deploy ContractPath:ContractName$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Cleaning and building...$(NC)"
	forge clean && forge build
	@echo "$(GREEN)Deploying $(word 2,$(MAKECMDGOALS))...$(NC)"
	forge create $(word 2,$(MAKECMDGOALS)) --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) --legacy --broadcast

script:
	@echo "$(YELLOW)Running script...$(NC)"
	@if [ -z "$(word 2,$(MAKECMDGOALS))" ]; then \
		echo "$(RED)Error: Script path is required. Usage: make script ScriptPath$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Cleaning and building...$(NC)"
	forge clean && forge build
	forge script $(word 2,$(MAKECMDGOALS)) --rpc-url $(RPC_URL) --private-key $(PRIVATE_KEY) --legacy --broadcast

# Code formatting and linting
format:
	@echo "$(YELLOW)Formatting code...$(NC)"
	forge fmt

lint:
	@echo "$(YELLOW)Linting code...$(NC)"
	forge fmt --check
