#!/bin/bash

sed -r -i -e "s|\\{ mappings: '' \\}|null|" -e 's|indent:|sourcemap: true, indent:|' ../rollup.config.js
