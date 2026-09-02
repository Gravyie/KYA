/**
 * Phosphor icons, deep-imported.
 *
 * The barrel (`from '@phosphor-icons/react'`) pulls all ~9,000 icon modules
 * through the transform pipeline. Tree-shaking removes most of them from the
 * output, but the production bundle still landed at 393 kB versus 199 kB before
 * the barrel was introduced, and the dev server pays the parse cost on every
 * cold start.
 *
 * Deep-importing the exact icons we use keeps the cost proportional to the
 * fourteen we actually render. Any new icon must be added here rather than
 * imported from the barrel at the call site.
 */
export {ShieldCheck} from '@phosphor-icons/react/dist/csr/ShieldCheck';
export {Scales} from '@phosphor-icons/react/dist/csr/Scales';
export {Receipt} from '@phosphor-icons/react/dist/csr/Receipt';
export {ArrowRight} from '@phosphor-icons/react/dist/csr/ArrowRight';
export {ArrowUpRight} from '@phosphor-icons/react/dist/csr/ArrowUpRight';
export {Fingerprint} from '@phosphor-icons/react/dist/csr/Fingerprint';
export {Signature} from '@phosphor-icons/react/dist/csr/Signature';
export {Cube} from '@phosphor-icons/react/dist/csr/Cube';
export {Lightning} from '@phosphor-icons/react/dist/csr/Lightning';
export {SealCheck} from '@phosphor-icons/react/dist/csr/SealCheck';
export {Prohibit} from '@phosphor-icons/react/dist/csr/Prohibit';
export {Database} from '@phosphor-icons/react/dist/csr/Database';
export {Cpu} from '@phosphor-icons/react/dist/csr/Cpu';
