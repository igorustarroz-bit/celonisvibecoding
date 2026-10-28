/* =========================================================================
   interactive-asset — the site's own block, ported.

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   The logic below is the site's own `src/blocks/interactive-asset/
   interactive-asset.js`, recovered from the published source map on the
   preview host. It is kept line-for-line so that a scene written against it
   here runs against the real one there without a change.

   Two deviations, both deliberate:

   1. MODULE FORM. Theirs is an ES module:

          import { getOptionsFromBlock } from '@helpers/getters/block.js';
          import { getAsset, getAvailableAssets } from './asset-registry.js';
          ...
          export default async function decorate(block) { ... }

      Here the two imports come from globals and the export is a registration
      on `window.EDSBlocks`, because a module cannot be imported from
      `file://`. Migrating back is those four lines and nothing else.

   2. PROPS FORWARDING — a proposed upstream change, marked CHANGE #1 below.
      Their version forwards exactly two authored options to the asset
      (`modalHash`, `videoAnimation`), so an asset can be placed but not
      configured. One line makes every authored row reach the component, which
      is what lets an author tune a scene from the document. Everything else
      is unchanged, and the asset works either way.
   ========================================================================= */
(function () {
  "use strict";

  const getOptionsFromBlock = window.EDSLite.getOptionsFromBlock;
  const getAsset = function (name) { return window.AssetRegistry.getAsset(name); };
  const getAvailableAssets = function () { return window.AssetRegistry.getAvailableAssets(); };

  /**
   * @typedef {Object} BlockOptions
   * @property {string} [name] - Name of the interactive asset
   * @property {string} [modalHash] - URL hash for modal integration
   * @property {boolean} [videoAnimation] - Whether to use video animation
   */

  /** @type BlockOptions */
  const DEFAULT_OPTIONS = {
    name: "",
    modalHash: "",
    videoAnimation: false,
  };

  /**
   * Loads and initializes the interactive asset based on the provided name
   * @param {string} name - Name of the interactive asset to load
   * @param {HTMLElement} container - Container element for the asset
   * @param {Object} options - Configuration options for the asset
   */
  async function loadInteractiveAsset(name, container, options) {
    if (!name) {
      console.error("Interactive asset name is required");
      return;
    }

    try {
      // Get the asset class from the registry
      const AssetClass = getAsset(name);

      if (!AssetClass) {
        const availableAssets = getAvailableAssets().join(", ");
        throw new Error('Asset "' + name + '" not found in registry. Available assets: ' + availableAssets);
      }

      // Initialize the interactive asset
      const assetInstance = new AssetClass({
        target: container,
        props: Object.assign(
          // CHANGE #1 (ours): forward every authored option, so a scene can be
          // configured from the document instead of only placed. Theirs sends
          // the two keys below and nothing else.
          {}, options,
          {
            modalHash: options.modalHash,
            videoAnimation: options.videoAnimation || false,
          }
        ),
      });

      // Store reference for potential cleanup
      container.assetInstance = assetInstance;
    } catch (error) {
      console.error("Failed to load interactive asset: " + name, error);
      const errorWrapper = document.createElement("div");
      errorWrapper.classList.add("interactive-asset-error");

      const nameParagraph = document.createElement("p");
      nameParagraph.textContent = "Failed to load interactive asset: " + name;

      const detailsParagraph = document.createElement("p");
      detailsParagraph.classList.add("error-details");
      detailsParagraph.textContent = error.message;

      errorWrapper.append(nameParagraph, detailsParagraph);
      container.replaceChildren(errorWrapper);
    }
  }

  /**
   * Decorates the interactive asset block
   * @param {HTMLElement} block
   */
  async function decorate(block) {
    // Parse options from block structure
    const options = getOptionsFromBlock(block, DEFAULT_OPTIONS);

    // Clear the block
    block.replaceChildren();

    // Create container for the interactive asset
    const container = document.createElement("div");
    container.classList.add("interactive-asset-container");

    // Add data attributes for styling/debugging
    if (options.name) {
      container.dataset.assetName = options.name;
    }

    block.append(container);

    // Load the interactive asset
    await loadInteractiveAsset(options.name, container, options);
  }

  window.EDSBlocks["interactive-asset"] = decorate;
})();
