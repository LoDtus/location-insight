ifeq ($(OS),Windows_NT)
GIT_SH ?= C:/Program Files/Git/bin/sh.exe
SHELL := $(GIT_SH)
endif

COMPOSE_DEV := docker compose --env-file .env.development -f infra/docker-compose.dev.yml
WEBSITE_DIR := website

define run_website_npm
if [ -f "$(WEBSITE_DIR)/node_modules/.bin/$(1)" ]; then \
	cd $(WEBSITE_DIR) && npm run $(2); \
else \
	$(COMPOSE_DEV) run --rm --no-deps website sh -c "npm ci && npm run $(2)"; \
fi
endef

.PHONY: help lint lint-fix test test-watch check \
	dev-up dev-down dev-stop dev-build dev-rebuild dev-logs dev-ps dev-reset check-no-dev-reset

.DEFAULT_GOAL := help

help:
	@echo "Common:"
	@echo "  make test [WATCH=1]           Chạy unit test website"
	@echo "  make test-watch               Chạy vitest ở chế độ watch"
	@echo "  make lint                     Kiểm tra ESLint"
	@echo "  make lint-fix                 Tự sửa lỗi ESLint có thể fix"
	@echo "  make check                    Chạy lint, test và kiểm tra không lọt công cụ reset dev"
	@echo "  make check-no-dev-reset       Kiểm tra cấu hình/Dockerfile production không chứa /reset"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up                   Khởi động website, backend và hạ tầng, hot reload trong Docker"
	@echo "                                Elasticsearch cần vm.max_map_count=262144"
	@echo "  make dev-down                 Dừng stack và xóa network"
	@echo "  make dev-stop                 Dừng container"
	@echo "  make dev-build                Build image development rồi npm ci"
	@echo "  make dev-rebuild              Build lại và recreate website"
	@echo "  make dev-logs                 Xem log website"
	@echo "  make dev-ps                   Xem trạng thái container"
	@echo "  make dev-reset                Dừng stack và xóa volume, gồm database local"

lint:
	@$(call run_website_npm,eslint,lint)

lint-fix:
	@$(call run_website_npm,eslint,lint:fix)

test:
ifneq ($(WATCH),1)
	@$(call run_website_npm,vitest,test:run)
else
	@$(MAKE) test-watch
endif

test-watch:
	@$(call run_website_npm,vitest,test)

check: lint test check-no-dev-reset

check-no-dev-reset:
	@sh infra/check-no-dev-reset.sh

dev-up:
	$(COMPOSE_DEV) up -d

dev-down:
	$(COMPOSE_DEV) down --remove-orphans

dev-stop:
	$(COMPOSE_DEV) stop

dev-build:
	$(COMPOSE_DEV) build
	$(COMPOSE_DEV) run --rm --no-deps website npm ci
	$(COMPOSE_DEV) run --rm --no-deps backend npm ci

dev-rebuild:
	$(COMPOSE_DEV) build
	$(COMPOSE_DEV) run --rm --no-deps website npm ci
	$(COMPOSE_DEV) run --rm --no-deps backend npm ci
	$(COMPOSE_DEV) up -d --force-recreate

dev-logs:
	$(COMPOSE_DEV) logs -f

dev-ps:
	$(COMPOSE_DEV) ps

dev-reset:
	$(COMPOSE_DEV) down -v --remove-orphans
