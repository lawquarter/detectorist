#!/bin/sh
# Rebuild index.html from the source modules
{
  printf '<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
  echo '<style>'; cat style.css; echo '</style>'
  cat ui.html
  echo '<script>'; cat three.min.js; echo '</script>'
  echo '<script>'; cat data.js; cat world.js; cat game.js; echo '</script>'
} > index.html
