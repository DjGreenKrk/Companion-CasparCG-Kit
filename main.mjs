// Entry for Companion (module API 2.x): the instance class as the default export and the upgrade scripts as the
// named export UpgradeScripts. The module itself is CommonJS (index.js); the build bundles both into one file.
import CasparInstance from './index.js'

export default CasparInstance
export const UpgradeScripts = CasparInstance.UpgradeScripts
