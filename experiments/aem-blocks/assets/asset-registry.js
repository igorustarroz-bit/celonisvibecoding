/* =========================================================================
   asset-registry — the site's own registry, ported.

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   Theirs, verbatim from the published source map
   (src/blocks/interactive-asset/asset-registry.js):

       import PeriodicTable from '@celonis/c-web-interactives/PeriodicTable';

       const ASSET_REGISTRY = {
         PeriodicTable,
         // Add more assets here as they become available
         // NetworkDiagram,
         // TimelineViz,
         // DataExplorer,
       };

   That comment is the whole handover: an experiment of ours becomes a line in
   that object. Here the registry is a global rather than a module (see
   eds-lite.js for why) and holds our scene instead of theirs.
   ========================================================================= */
(function () {
  "use strict";

  const ASSET_REGISTRY = {
    // Registered by assets/context-model.js when it loads.
  };

  window.AssetRegistry = {
    register: function (name, AssetClass) { ASSET_REGISTRY[name] = AssetClass; },
    getAsset: function (name) { return ASSET_REGISTRY[name] || null; },
    getAvailableAssets: function () { return Object.keys(ASSET_REGISTRY); },
    hasAsset: function (name) { return name in ASSET_REGISTRY; },
  };
})();
