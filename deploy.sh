#!/bin/bash

TEMP_FILE=temp/temp.js

if [ -e TEMP_FILE ]; then
  rm TEMP_FILE
fi

yarn rollup -c rollup_build.config.js
java -jar compiler.jar --language_out ECMASCRIPT_2015 --js $TEMP_FILE --js_output_file dist/main.js
yarn rollup -c rollup_deploy.config.js

