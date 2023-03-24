import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { ID, sceneCache } from './globals';
import { isBackgroundImage }  from './itemFilters';
import { setupContextMenus, createActions, createMode, createTool, onSceneDataChange } from './visionTool';

// Create the extension page
document.querySelector('#app').innerHTML = `
  <div>
    <h1>Owlbear Rodeo Vision</h1>
    <h2>Settings</h2>
    <p>Map size: <span id="vision_size">N/A</span></p>
    <p>Token vision radius: </p>
    <p>Unlimited <input type="checkbox" id="vision_range_checkbox"><input type="range" min="1" max="150" value="60" class="slider" id="token_vision_radius"> <span id="token_vision_text">60 ft</span></p>
    <p>Vision: <input type="checkbox" id="vision_checkbox"></p>
    <br><hr><br>
    <h2>Debug</h2>
    <h3>Performance Info</h3>
    <ul>
      <li><p>Compute time: <span id=compute_time>N/A</span></p></li>
      <li><p>Communication time: <span id=communication_time>N/A</span></p></li>
      <li><p>Cache hits/misses: <span id=cache_hits>?</span>/<span id=cache_misses>?</span></p></li>
    </ul>
  </div>
`
async function setButtonHandler() {
  const visionCheckbox = document.getElementById("vision_checkbox");
  const unlimitedCheckbox = document.getElementById("vision_range_checkbox");
  const rangeSlider = document.getElementById("token_vision_radius");
  const rangeText = document.getElementById("token_vision_text");

  // The visionCheckbox element is responsible for toggling vision updates
  visionCheckbox.addEventListener("click", async event => {
    await OBR.scene.setMetadata({[`${ID}/visionEnabled`]: event.target.checked});
  }, false);

  // When unlimitedCheckbox is checked, there is no limit to the player tokens'
  // vision range
  unlimitedCheckbox.addEventListener("click", async event => {
    let value = false;
    if (event.target.checked) {
      rangeSlider.setAttribute("disabled", "disabled");
      rangeText.style.visibility = "hidden";
    }
    else {
      value = parseInt(rangeSlider.value);
      rangeSlider.removeAttribute("disabled");
      rangeText.style.visibility = "visible";
    }
    await OBR.scene.setMetadata({[`${ID}/playerVisionRange`]: value});
  }, false);

  // The rangeSlider slider controls the radius of the players' vision range
  rangeSlider.addEventListener("change", async event => {
    rangeText.innerText = `${event.target.value} ft`;
    await OBR.scene.setMetadata({[`${ID}/playerVisionRange`]: parseInt(event.target.value)});
  }, false);

  // Populate the initial values
  const [backgroundImages, metadata, dpi] = await Promise.all([
    await OBR.scene.items.getItems(isBackgroundImage),
    await OBR.scene.getMetadata(),
    await OBR.scene.grid.getDpi(),
  ]);
  const backgroundImage = backgroundImages.length ? backgroundImages[0] : undefined;
  if (backgroundImage) {
    const dpiRatio = dpi / backgroundImage.grid.dpi;
    const size = [backgroundImage.image.width * dpiRatio, backgroundImage.image.height * dpiRatio];
    document.getElementById("vision_size").innerText = `${size[0]}x${Math.round(size[1])} px`;
  }
  visionCheckbox.checked = metadata[`${ID}/visionEnabled`] = true;
}

// Setup extension add-ons
OBR.onReady(() => {
  OBR.player.getRole().then(async value => {
    // But only if user is the GM
    if (value == "GM") {
      setButtonHandler();
      setupContextMenus();
      createTool();
      createMode();
      createActions();
      
      let fogFilled, fogColor;
      [sceneCache.items, sceneCache.metadata, sceneCache.gridDpi, sceneCache.gridScale, fogFilled, fogColor] = await Promise.all([
        OBR.scene.items.getItems(),
        OBR.scene.getMetadata(),
        OBR.scene.grid.getDpi(),
        OBR.scene.grid.getScale(),
        OBR.scene.fog.getFilled(),
        OBR.scene.fog.getColor()
      ]);
      sceneCache.gridScale = sceneCache.gridScale.parsed.multiplier;
      sceneCache.fog = {filled: fogFilled, style: {color: fogColor, strokeWidth: 5}};

      let image = undefined;
      if (sceneCache.items.filter(isBackgroundImage).length == 0) {
        const images = sceneCache.items.filter(item => item.layer == "MAP" && item.type == "IMAGE");
        const areas = images.map(image => image.image.width * image.image.height / Math.pow(image.grid.dpi, 2));
        image = images[areas.indexOf(Math.max(...areas))];
      }

      OBR.scene.fog.onChange(fog => {
        sceneCache.fog = fog;
      });

      OBR.scene.items.onChange(items => {
        sceneCache.items = items;
        onSceneDataChange();
      });

      OBR.scene.grid.onChange(grid => {
        sceneCache.gridDpi = grid.dpi;
        sceneCache.gridScale = parseInt(grid.scale);
        onSceneDataChange();
      });

      OBR.scene.onMetadataChange(metadata => {
        sceneCache.metadata = metadata;
        onSceneDataChange();
      });

      if (image !== undefined) {
        await OBR.scene.items.updateItems([image], items => {
          items[0].metadata[`${ID}/isBackgroundImage`] = true;
        });
      }
    }
  }
  )
});