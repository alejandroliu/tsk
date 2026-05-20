# tsk — TypeScript compiler using QuickJS (no Node.js / npm)

TS_VERSION  ?= 5.4.5
TS_URL       = https://registry.npmjs.org/typescript/-/typescript-$(TS_VERSION).tgz

.PHONY: version clean distclean fetch-ts  test

version:
	qjs --std -I node_shim.js typescript-$(TS_VERSION)/tsc.js --version

# ── Fetch TypeScript
# Extracts tsc.js and all lib .d.ts files into ./typescript-$(TS_VERSION)/
fetch-ts:
	@echo ">>> Downloading TypeScript $(TS_VERSION)..."
	mkdir -p typescript-$(TS_VERSION)
	curl -fsSL "$(TS_URL)" | tar xz --wildcards \
	    --transform 's|package/lib/|typescript-$(TS_VERSION)/|' \
	    'package/lib/tsc.js' \
	    'package/lib/lib.d.ts' \
	    'package/lib/lib.*.d.ts'
	@echo ">>> $(shell ls typescript-$(TS_VERSION)/*.d.ts 2>/dev/null | wc -l | tr -d ' ') lib files + tsc.js in typescript-$(TS_VERSION)/"

# ── Tests ─────────────────────────────────────────────────────────────────
test: test-shim test-tsc

test-shim:
	qjs --std -I node_shim.js -I test_runner.js shim_tests.js

test-tsc:
	qjs --std -I node_shim.js -I test_runner.js tsc_tests.js


# ── Clean ─────────────────────────────────────────────────────────────────
clean:
	:

distclean:
	rm -rf typescript-$(TS_VERSION)
