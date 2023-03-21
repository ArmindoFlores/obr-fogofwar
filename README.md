---
title: Dynamic Fog Of War
description: Dynamic fog of war for battlemaps
author: Francisco Rodrigues
image: https://raw.githubusercontent.com/ArmindoFlores/obr-fogofwar/main/resources/example.png
icon: https://raw.githubusercontent.com/ArmindoFlores/obr-fogofwar/main/resources/icon.svg
tags:
  - vision
  - fog
manifest: https://raw.githubusercontent.com/ArmindoFlores/obr-fogofwar/main/manifest.json
learn-more: https://github.com/ArmindoFlores/obr-fogofwar
---

# Dynamic Fog of War

Add dynamic fog of war to your battlemaps for more interesting fights!

You can draw walls and objects that obscure a scene using the vision tool on the right.

You can set the vision range of the players on the extension popover, as well as activate and deactivate the fog display.

You can set the background image by clicking on it and selecting the "Set as background image" option.

When using multiple player tokens, the fog of war will be combined so only the areas obscured to *every* player will be shown as fog.

# Example

![Vision Example](https://raw.githubusercontent.com/ArmindoFlores/obr-fogofwar/main/resources/example.png)

In this example you can see two tokens' fog of war displayed. Both point of views and vision ranges are taken into account to draw the final shadows. In the following image you can see which polygons were drawn to achieve this effect (shown with a light gray outline):

![Polygon Example](https://raw.githubusercontent.com/ArmindoFlores/obr-fogofwar/main/resources/example-explanation.png)