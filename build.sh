#!/bin/sh
# Rebuild index.html from the source modules
{
  printf '<meta charset="utf-8">\n'
  echo '<style>'; cat style.css; echo '</style>'
  cat ui.html
  echo '<script>'; cat three.min.js; echo '</script>'
  echo '<script>'; cat data.js; cat world.js; cat game.js; echo '</script>'
} > index.html
