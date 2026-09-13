# KC3Kai remodel rules

`RemodelDb.js` is an unmodified MIT-licensed source snapshot from KC3Kai/KC3Kai,
commit `bd2c653def167799367a686ea15bb1c94c1167c4` (2026-08-28).
Source: https://github.com/KC3Kai/KC3Kai/blob/bd2c653def167799367a686ea15bb1c94c1167c4/src/library/modules/RemodelDb.js
Copyright and license are retained in LICENSE.

The build-time importer uses only calcDevMat/calcTorch/calcGunMat/calcScrew/
calcArsenalMat. It does not use browser globals, localStorage, mkDb, the
count-based cache, or KC3's default-zero handling for missing master data.
Update the source pin and vendor snapshot together and rerun adapter tests.
