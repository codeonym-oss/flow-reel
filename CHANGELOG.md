# Changelog

## [0.6.0](https://github.com/codeonym-oss/flow-reel/compare/v0.5.0...v0.6.0) (2026-11-20)


### Features

* compose faster, with quicker card frames and no master file ([#95](https://github.com/codeonym-oss/flow-reel/issues/95)) ([5920369](https://github.com/codeonym-oss/flow-reel/commit/592036942712c26f42a41ac0e5fc89c757de06fb))

## [0.5.0](https://github.com/codeonym-oss/flow-reel/compare/v0.4.0...v0.5.0) (2026-11-17)


### ⚠ BREAKING CHANGES

* add feature, image and compare cards, and retire showFrame ([#78](https://github.com/codeonym-oss/flow-reel/issues/78)) (#83)

### Features

* add feature, image and compare cards, and retire showFrame ([#78](https://github.com/codeonym-oss/flow-reel/issues/78)) ([#83](https://github.com/codeonym-oss/flow-reel/issues/83)) ([9c82c07](https://github.com/codeonym-oss/flow-reel/commit/9c82c07af059216919c19a8c03d714f0fb266212))
* insert cards into reels, drawn in the brand's theme with transitions ([#77](https://github.com/codeonym-oss/flow-reel/issues/77)) ([#82](https://github.com/codeonym-oss/flow-reel/issues/82)) ([86e5174](https://github.com/codeonym-oss/flow-reel/commit/86e5174388a8cea0d6400f81958888bf5be7d679))
* show callouts, highlights and lower thirds over the app ([#79](https://github.com/codeonym-oss/flow-reel/issues/79)) ([#84](https://github.com/codeonym-oss/flow-reel/issues/84)) ([cec4323](https://github.com/codeonym-oss/flow-reel/commit/cec432357bf2ba3e114d9daf2affcac33fccc8e8))

## [0.4.0](https://github.com/codeonym-oss/flow-reel/compare/v0.3.1...v0.4.0) (2026-11-16)


### Features

* skip a wait in a reel ([#62](https://github.com/codeonym-oss/flow-reel/issues/62)) ([#67](https://github.com/codeonym-oss/flow-reel/issues/67)) ([f97bf62](https://github.com/codeonym-oss/flow-reel/commit/f97bf62c95ad9837ca2dc7c55520717bfd3509f8))
* speed up a wait in a reel ([#61](https://github.com/codeonym-oss/flow-reel/issues/61)) ([#63](https://github.com/codeonym-oss/flow-reel/issues/63)) ([7988cee](https://github.com/codeonym-oss/flow-reel/commit/7988cee8f3a64a623f5a728e0661dfc38c7a456e))

## [0.3.1](https://github.com/codeonym-oss/flow-reel/compare/v0.3.0...v0.3.1) (2026-11-15)


### Bug Fixes

* default the OpenRouter voice to a model OpenRouter has ([#56](https://github.com/codeonym-oss/flow-reel/issues/56)) ([#57](https://github.com/codeonym-oss/flow-reel/issues/57)) ([834755b](https://github.com/codeonym-oss/flow-reel/commit/834755bf9064faf55932802472629f597bd23b38))

## [0.3.0](https://github.com/codeonym-oss/flow-reel/compare/v0.2.0...v0.3.0) (2026-11-15)


### Features

* speak comments with a cloud voice ([#49](https://github.com/codeonym-oss/flow-reel/issues/49)) ([#50](https://github.com/codeonym-oss/flow-reel/issues/50)) ([d9475c4](https://github.com/codeonym-oss/flow-reel/commit/d9475c459d1a3eceadee2470dfba7e05f8309842))

## [0.2.0](https://github.com/codeonym-oss/flow-reel/compare/v0.1.2...v0.2.0) (2026-11-15)


### ⚠ BREAKING CHANGES

* the mute flag is now --no-sound; --no-sfx is rejected as an unknown option.
* the event log is version 4; flow-reel compare reads only reels with a version 4 event log.
* results are no longer written as loose files beside the script, .flow-reel/ is no longer used, and compare takes reel folders instead of transcript files.
* demo, step and sfx are replaced by script, comment and sound; `flow-reel record` is now `flow-reel compose`; transcript version 2 and event log version 3.

### Features

* compose each script into a reel folder with a manifest ([#31](https://github.com/codeonym-oss/flow-reel/issues/31)) ([#39](https://github.com/codeonym-oss/flow-reel/issues/39)) ([745eb95](https://github.com/codeonym-oss/flow-reel/commit/745eb950b7550d11c4053f27b2148053426e3d82))
* configure the composer's voice and integration, and reuse voiced comments ([#33](https://github.com/codeonym-oss/flow-reel/issues/33)) ([#41](https://github.com/codeonym-oss/flow-reel/issues/41)) ([6aa66c4](https://github.com/codeonym-oss/flow-reel/commit/6aa66c4cd55262c27567fa832ea73f2decfb2e72))
* direct the picture with effect words that override automatic polish ([#32](https://github.com/codeonym-oss/flow-reel/issues/32)) ([#40](https://github.com/codeonym-oss/flow-reel/issues/40)) ([0c6018f](https://github.com/codeonym-oss/flow-reel/commit/0c6018fec6a3f0ee2ac134a7edac70f37de9ade1))
* name the mute flag --no-sound and play chained sounds on every action ([#34](https://github.com/codeonym-oss/flow-reel/issues/34)) ([#42](https://github.com/codeonym-oss/flow-reel/issues/42)) ([e26042b](https://github.com/codeonym-oss/flow-reel/commit/e26042b750d5253c271e0de7b9fe14ec5a1d84a7))
* write scripts with comment and sound words ([#30](https://github.com/codeonym-oss/flow-reel/issues/30)) ([516774d](https://github.com/codeonym-oss/flow-reel/commit/516774d4a445ca6c48a498e0b258937088ee5a67))

## [0.1.2](https://github.com/codeonym-oss/flow-reel/compare/v0.1.1...v0.1.2) (2026-11-14)


### Bug Fixes

* make wrapped actions faithful and stop odd viewports hanging the recorder ([#1](https://github.com/codeonym-oss/flow-reel/issues/1)) ([#23](https://github.com/codeonym-oss/flow-reel/issues/23)) ([c54f921](https://github.com/codeonym-oss/flow-reel/commit/c54f921d8cd5f62aa03aa2f7c8753e3c8d963793))

## [0.1.1](https://github.com/codeonym-oss/flow-reel/compare/v0.1.0...v0.1.1) (2026-11-13)


### Bug Fixes

* isolate npm registry consumer from checkout ([#9](https://github.com/codeonym-oss/flow-reel/issues/9)) ([#18](https://github.com/codeonym-oss/flow-reel/issues/18)) ([aba28ff](https://github.com/codeonym-oss/flow-reel/commit/aba28ffed308826ebed9edf2e47698fd53d8beb0))

## 0.1.0 (2026-11-12)


### Features

* add click, typing and action sound effects ([#8](https://github.com/codeonym-oss/flow-reel/issues/8)) ([#15](https://github.com/codeonym-oss/flow-reel/issues/15)) ([3d9d487](https://github.com/codeonym-oss/flow-reel/commit/3d9d4873a7f3f429823482617143fc130514b63e))
* add verified multi-arch release publishing ([#9](https://github.com/codeonym-oss/flow-reel/issues/9)) ([#16](https://github.com/codeonym-oss/flow-reel/issues/16)) ([ba70a7f](https://github.com/codeonym-oss/flow-reel/commit/ba70a7f60961d8d7c65f71ca82bfa2ae0dffeef3))
* fit narration, mux audio and compare recordings ([#5](https://github.com/codeonym-oss/flow-reel/issues/5)) ([#13](https://github.com/codeonym-oss/flow-reel/issues/13)) ([bd9ea78](https://github.com/codeonym-oss/flow-reel/commit/bd9ea78fd9e5f5415db091efddcc599212091844))
* generate offline Qwen narration clips ([#4](https://github.com/codeonym-oss/flow-reel/issues/4)) ([#12](https://github.com/codeonym-oss/flow-reel/issues/12)) ([2e1e32d](https://github.com/codeonym-oss/flow-reel/commit/2e1e32dbdc5422d25006348f9145a5586b358772))
* preserve narration and write SRT/VTT captions ([#3](https://github.com/codeonym-oss/flow-reel/issues/3)) ([#11](https://github.com/codeonym-oss/flow-reel/issues/11)) ([108af29](https://github.com/codeonym-oss/flow-reel/commit/108af299010b12591ea4a55824d5ee6c193a8161))
* record a demo script in a sandbox as a silent MP4 with step timings ([#2](https://github.com/codeonym-oss/flow-reel/issues/2)) ([#10](https://github.com/codeonym-oss/flow-reel/issues/10)) ([1fa4e5d](https://github.com/codeonym-oss/flow-reel/commit/1fa4e5dc3f782d902acd1c66ffd574f0d8b7cd06))
* render cursor, click ripples and automatic zoom ([#7](https://github.com/codeonym-oss/flow-reel/issues/7)) ([#14](https://github.com/codeonym-oss/flow-reel/issues/14)) ([4dc3740](https://github.com/codeonym-oss/flow-reel/commit/4dc374072dacfa5cdd70801a9199fa2f92cd7695))
