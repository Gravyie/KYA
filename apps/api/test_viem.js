import { privateKeyToAccount } from 'viem/accounts';

try { privateKeyToAccount('0xundefined'); } catch(e) { console.log('0xundefined:', e.message); }
try { privateKeyToAccount('0xnull'); } catch(e) { console.log('0xnull:', e.message); }
try { privateKeyToAccount('0x'); } catch(e) { console.log('0x:', e.message); }
try { privateKeyToAccount('undefined'); } catch(e) { console.log('undefined:', e.message); }
try { privateKeyToAccount(''); } catch(e) { console.log('empty:', e.message); }
