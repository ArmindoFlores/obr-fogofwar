import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { ID, sceneCache } from './globals';
import { isBackgroundImage, isPlayerWithVision }  from './itemFilters';
import { setupContextMenus, createActions, createMode, createTool, onSceneDataChange } from './visionTool';

// Create the extension page
const app = document.querySelector('#app');
app.style.textAlign = "left";
app.parentElement.style.placeItems = "start";
app.innerHTML = `
  <div>
    <div>
      <h1 style="display: inline-block; font-size: 2.2em;">Dynamic Fog&nbsp;&nbsp;</h1><input type="checkbox" id="vision_checkbox" class="large">
    </div>
    <hr>
    <div style="text-align: center;">
      <p style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width:16em">Map: <span id="map_name">No map selected</span></p>
      <p><span id="map_size">Please set your map as a background</span></p>
      <hr>
      <h2 style="margin-bottom: 0;">Vision Radius</h2>
      <p id="no_tokens_message">Enable vision on your character tokens</p>
      <div id="token_list_div" style="display: block;">
        <table style="margin: auto; padding: 0;"><tbody id="token_list">
        </tbody></table>
      </div>
      </div>
    <div id="debug_div" style="display: none;">
      <br><hr><br>
      <h2>Debug</h2>
      <h3>Performance Info</h3>
      <ul>
        <li><p>Compute time: <span id=compute_time>N/A</span></p></li>
        <li><p>Communication time: <span id=communication_time>N/A</span></p></li>
        <li><p>Cache hits/misses: <span id=cache_hits>?</span>/<span id=cache_misses>?</span></p></li>
      </ul>
    </div>
  </div>
`
async function setButtonHandler() {
  const visionCheckbox = document.getElementById("vision_checkbox");

  // The visionCheckbox element is responsible for toggling vision updates
  visionCheckbox.addEventListener("click", async event => {
    if (!sceneCache.ready) {
      event.preventDefault();
      return;
    }
    await OBR.scene.setMetadata({[`${ID}/visionEnabled`]: event.target.checked});
  }, false);
}

function updateUI(items)
{
  const table = document.getElementById("token_list");
  const message = document.getElementById("no_tokens_message");
  const visionCheckbox = document.getElementById("vision_checkbox");
  const playersWithVision = items.filter(isPlayerWithVision);

  if (sceneCache.metadata)
    visionCheckbox.checked = sceneCache.metadata[`${ID}/visionEnabled`] == true;

  if (playersWithVision.length > 0)
    message.style.display = "none";
  else
    message.style.display = "block";

  const tokenTableEntries = document.getElementsByClassName("token-table-entry");
  const toRemove = [];
  for (const token of tokenTableEntries) {
    const tokenId = token.id.slice(3);
    if (playersWithVision.find(player => player.id === tokenId) === undefined)
      toRemove.push(token);
  }
  for (const token of toRemove)
    token.remove();

  for (const player of playersWithVision) {
    const tr = document.getElementById(`tr-${player.id}`);
    if (tr) {
      // Update with current information
      const name = tr.getElementsByClassName("token-name")[0]
      const rangeInput = tr.getElementsByClassName("token-vision-range")[0];
      const unlimitedCheckbox = tr.getElementsByClassName("unlimited-vision")[0];
      if (name)
        name.innerText = player.name;
      if (rangeInput) {
        if (!unlimitedCheckbox.checked)
          rangeInput.value = player.metadata[`${ID}/visionRange`] ? player.metadata[`${ID}/visionRange`] : 60;
      }
      if (unlimitedCheckbox) {
        unlimitedCheckbox.checked = !player.metadata[`${ID}/visionRange`];
      }
      if (unlimitedCheckbox.checked)
        rangeInput.setAttribute("disabled", "disabled");
      else
        rangeInput.removeAttribute("disabled");
    }
    else {
      // Create new item for this token
      const newTr = document.createElement("tr");
      newTr.id = `tr-${player.id}`;
      newTr.className = "token-table-entry";
      newTr.innerHTML = `<td class="token-name">${player.name}</td><td><input class="token-vision-range" type="number" value="60"><span class="unit">ft</span></td><td>&nbsp;&nbsp;&infin;&nbsp<input type="checkbox" class="unlimited-vision"></td>`;
      table.appendChild(newTr);
      
      // Register event listeners
      const rangeInput = newTr.getElementsByClassName("token-vision-range")[0];
      const unlimitedCheckbox = newTr.getElementsByClassName("unlimited-vision")[0];
      rangeInput.addEventListener("change", async event => {
        const value = parseInt(event.target.value);
        if (value < 0)
          event.target.value = 0;
        if (value > 999)
          event.target.value = 999;
        await OBR.scene.items.updateItems([player], items => {
          items[0].metadata[`${ID}/visionRange`] = parseInt(value);
        });
      }, false);
      unlimitedCheckbox.addEventListener("click", async event => {
        let value = false;
        if (event.target.checked)
          rangeInput.setAttribute("disabled", "disabled");
        else {
          value = parseInt(rangeInput.value);
          rangeInput.removeAttribute("disabled");
        }
        await OBR.scene.items.updateItems([player], items => {
          items[0].metadata[`${ID}/visionRange`] = parseInt(value);
        });
      }, false);
    }
  }
}

async function initScene() 
{
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

  updateUI(sceneCache.items);

  if (image !== undefined) {
    await OBR.scene.items.updateItems([image], items => {
      items[0].metadata[`${ID}/isBackgroundImage`] = true;
    });
  }
}

// Setup extension add-ons
OBR.onReady(() => {
  OBR.player.getRole().then(async value => {
    // Allow the extension to load for any player
    // This is now needed because each player updates their own
    // local fog paths.
    // If you don't wish to show the UI here for players
    // then the UI should probably be hidden and an
    // information message displayed
    if (value == "GM" || value == "PLAYER") {
      setButtonHandler();
      setupContextMenus();
      createTool();
      createMode();
      createActions();

      OBR.scene.fog.onChange(fog => {
        sceneCache.fog = fog;
      });

      OBR.scene.items.onChange(items => {
        sceneCache.items = items;
        if (sceneCache.ready) {
          updateUI(items);
          onSceneDataChange();
        }
      });

      OBR.scene.grid.onChange(grid => {
        sceneCache.gridDpi = grid.dpi;
        sceneCache.gridScale = parseInt(grid.scale);
        if (sceneCache.ready)
          onSceneDataChange();
      });

      OBR.scene.onMetadataChange(metadata => {
        sceneCache.metadata = metadata;
        if (sceneCache.ready)
          onSceneDataChange();
      });

      OBR.scene.onReadyChange(ready => {
        sceneCache.ready = ready;
        if (ready) {
          initScene();
          onSceneDataChange();
        }
        else 
          updateUI([]);
      });

      sceneCache.ready = await OBR.scene.isReady();
      if (sceneCache.ready) {
        initScene();
        onSceneDataChange();
      }
      else
        updateUI([]);
    }
  }
  )
});