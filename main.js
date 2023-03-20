import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { ID, VISION_LOOP_UPDATE_FREQUENCY } from './constants';
import { isBackgroundImage }  from './itemFilters';
import { setupContextMenus, createActions, createMode, createTool, mainVisionLoop } from './visionTool';

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
  visionCheckbox.checked = metadata[`${ID}/visionEnabled`] === true;
}

// Setup extension add-ons
OBR.onReady(() => {
  OBR.player.getRole().then(value => {
    // But only if user is the GM
    if (value == "GM") {
      setButtonHandler();
      setupContextMenus();
      createTool();
      createMode();
      createActions();
      setInterval(mainVisionLoop, VISION_LOOP_UPDATE_FREQUENCY);
    }
  }
  )
});
