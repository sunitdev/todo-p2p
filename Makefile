SHELL := /bin/sh
.DEFAULT_GOAL := help

DERIVED_DATA ?= DerivedData/Steps25To29
MAC_APP = $(DERIVED_DATA)/Mac/Build/Products/Debug/TodoP2PMac.app
IPHONE_APP = $(DERIVED_DATA)/iOS/Build/Products/Debug-iphonesimulator/TodoP2PiOS.app
SIMULATOR ?= $(shell xcrun simctl list devices available --json | python3 -c 'import json,re,sys; runtimes=sorted(json.load(sys.stdin)["devices"].items(),key=lambda item:tuple(map(int,re.findall(r"\d+",item[0]))),reverse=True); phones=[d for runtime,devices in runtimes if "iOS" in runtime and int(re.findall(r"\d+",runtime)[0])>=27 for d in devices if d["name"].startswith("iPhone")]; print(next((d["udid"] for d in phones if d["state"]=="Booted"),phones[0]["udid"] if phones else ""))')

.PHONY: help mac iphone build-mac build-iphone simulators

help:
	@printf '%s\n' 'make mac           Build and open the macOS app' 'make iphone        Build, boot, install and launch on an iPhone Simulator' 'make simulators    List available simulator IDs' 'make iphone SIMULATOR=<UUID>  Choose a simulator' 'Optional: DERIVED_DATA=<path>; TODO_P2P_TEST_DIRECTORY=<synthetic path>'

build-mac:
	env -u LOCAL_BUILD xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PMac -configuration Debug -destination 'platform=macOS,arch=arm64' -derivedDataPath "$(DERIVED_DATA)/Mac" CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual build

mac: build-mac
	@if [ -n "$$TODO_P2P_TEST_DIRECTORY" ]; then \
		open --env "TODO_P2P_TEST_DIRECTORY=$$TODO_P2P_TEST_DIRECTORY" "$(MAC_APP)"; \
	else \
		open "$(MAC_APP)"; \
	fi

build-iphone:
	env -u LOCAL_BUILD xcodebuild -project TodoP2P.xcodeproj -scheme TodoP2PiOS -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath "$(DERIVED_DATA)/iOS" CODE_SIGNING_ALLOWED=NO build

iphone: build-iphone
	@test -n "$(SIMULATOR)" || { printf '%s\n' 'No compatible iPhone Simulator found. Install an iOS 27+ runtime in Xcode.' >&2; exit 1; }
	xcrun simctl bootstatus "$(SIMULATOR)" -b
	@simulator_app="$$(xcode-select -p)/Applications/Simulator.app"; \
	if [ -d "$$simulator_app" ]; then \
		open "$$simulator_app" --args -CurrentDeviceUDID "$(SIMULATOR)"; \
	else \
		printf '%s\n' 'Simulator.app is unavailable; launching on the simulator runtime without a graphical window.' >&2; \
	fi
	xcrun simctl install "$(SIMULATOR)" "$(IPHONE_APP)"
	@if [ -n "$$TODO_P2P_TEST_DIRECTORY" ]; then \
		export SIMCTL_CHILD_TODO_P2P_TEST_DIRECTORY="$$TODO_P2P_TEST_DIRECTORY"; \
	fi; \
	xcrun simctl launch "$(SIMULATOR)" local.sunit.TodoP2PiOS

simulators:
	xcrun simctl list devices available
