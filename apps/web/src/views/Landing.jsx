import React, {useEffect, useMemo, useState} from 'react';
import {motion, useReducedMotion, AnimatePresence} from 'motion/react';
import {
  ShieldCheck,
  Scales,
  Receipt,
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Signature,
  Cube,
  Lightning,
  SealCheck,
  Prohibit,
  Database,
  Cpu,
} from '../components/phosphor.js';
import {api, pct} from '../lib/api.js';
import {Passport} from '../components/Passport.jsx';
import {Button} from '../components/ui/button';
import {Card, CardContent} from '../components/ui/card';
import {Badge} from '../components/ui/badge';

const GAPS = [
  {
    icon: Fingerprint,
    q: 'Who is accountable for this agent?',
    now: 'A wallet address. Anyone can make ten thousand of them before lunch.',
    kya: 'A World ID nullifier bound on-chain to the owner. One human, one identity, permanently.',
  },
  {
    icon: Scales,
    q: 'What is it actually allowed to do?',
    now: 'Whatever the README claims. Nothing checks it.',
    kya: 'A mandate the contract enforces. Over-limit settlement reverts and the attempt is recorded.',
  },
  {
    icon: Receipt,
    q: 'What has it actually done before?',
    now: 'Whatever the agent tells you about itself.',
    kya: 'Receipts submitted by the execution path, each carrying a 0G evidence digest. Never self-reported.',
  },
];

const LOOP = [
  {icon: Signature, label: 'Resolve', detail: 'ENS name to passport'},
  {icon: Scales, label: 'Decide', detail: 'registry returns a verdict'},
  {icon: Cpu, label: 'Execute', detail: '0G compute, TEE attested'},
  {icon: Database, label: 'Persist', detail: 'content-addressed record'},
  {icon: Receipt, label: 'Settle', detail: 'receipt written on-chain'},
  {icon: SealCheck, label: 'Verify', detail: 'hash chain recomputed'},
];

export default function Landing({onGo, integrations}) {
  const reduce = useReducedMotion();
  const [hero, setHero] = useState(null);
  const [roster, setRoster] = useState([]);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.agent('optimizer.kya.eth'), api.directory()])
      .then(([a, d]) => {
        if (!alive) return;
        setHero(a);
        setRoster(
          [...d.agents].sort((x, y) => {
            if ((x.rejected > 0) !== (y.rejected > 0)) return x.rejected > 0 ? 1 : -1;
            return y.score - x.score;
          }),
        );
      })
      .catch(() => alive && setDown(true));
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    const acts = roster.reduce((s, a) => s + a.total, 0);
    const blocked = roster.reduce((s, a) => s + a.rejected, 0);
    return {agents: roster.length, acts, blocked};
  }, [roster]);

  return (
    <div className="min-h-screen bg-black relative selection:bg-primary selection:text-black">
      {/* Background imagery: Halftone & ASCII */}
      <div className="fixed right-0 top-20 w-1/2 h-full opacity-30 pointer-events-none mix-blend-screen z-0">
        <img src="/images/halftone.jpg" alt="" className="w-full h-full object-cover filter contrast-125" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>
      
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-10 pointer-events-none mix-blend-screen z-0">
        <img src="/images/ascii.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-16">
        
        {/* ═══ hero ═══════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start mb-16">
          <div className="flex flex-col gap-6">
            <motion.div
              initial={reduce ? false : {opacity: 0, x: -20}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.2}}
            >
              <div className="inline-flex items-center gap-2 px-2 py-1 bg-primary text-black font-mono text-[10px] uppercase font-bold tracking-widest mb-6">
                <span className="w-2 h-2 bg-black animate-pulse" /> KYA_SYSTEM.INIT
              </div>
              <h1 className="text-6xl md:text-[5.5rem] font-sans font-bold tracking-tighter text-white leading-[0.95] uppercase">
                Every agent <br />
                <span className="text-primary border-b-[6px] border-primary pb-2 inline-block mt-2">gets a passport.</span>
              </h1>
            </motion.div>

            <motion.p
              className="text-xl text-muted-foreground max-w-[40ch] leading-snug font-sans mt-4"
              initial={reduce ? false : {opacity: 0, x: -20}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.2, delay: 0.05}}
            >
              A human-verified owner, a declared mandate, and a track record you can check before you delegate money or work.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-4 mt-6"
              initial={reduce ? false : {opacity: 0, x: -20}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.2, delay: 0.1}}
            >
              <Button size="lg" onClick={() => onGo('compare')} className="group font-mono uppercase font-bold tracking-widest text-xs rounded-none bg-primary text-black hover:bg-white hover:text-black border-2 border-primary hover:border-white transition-colors h-12 px-8">
                Open the live console
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" asChild className="font-mono uppercase font-bold tracking-widest text-xs rounded-none border-2 border-white/20 hover:bg-white/10 hover:text-white transition-colors h-12 px-8">
                <a href="#loop">See the loop</a>
              </Button>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 pt-8 border-t-2 border-white/10"
              initial={reduce ? false : {opacity: 0}}
              animate={{opacity: 1}}
              transition={{duration: 0.2, delay: 0.15}}
            >
              {[
                [ShieldCheck, 'WORLD ID BOUND', 'One human, one identity. A fresh wallet does not earn a fresh reputation.'],
                [Scales, 'MANDATE ENFORCED', 'Over-limit settlement reverts. Blocked attempts are recorded permanently.'],
                [Receipt, 'SECURE RECEIPTS', 'Only the execution path can settle one. Each carries 0G evidence.'],
              ].map(([Icon, title, detail]) => (
                <div key={title} className="flex flex-col gap-2">
                  <Icon size={24} className="text-primary mb-1" />
                  <h4 className="text-xs font-mono font-bold text-white tracking-widest">{title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-mono">{detail}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="relative"
            initial={reduce ? false : {opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3, delay: 0.1}}
          >
            <div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-black inline-flex px-2 py-1 border border-white/20">
              <span className={`w-2 h-2 rounded-none ${down ? 'bg-destructive' : 'bg-primary animate-pulse-glow'}`} />
              {down ? 'ERR: REGISTRY UNREACHABLE' : 'LIVE READ FROM REGISTRY'}
            </div>

            <div className="bg-black border-2 border-white/20 p-4 relative group hover:border-primary/50 transition-colors">
              <div className="absolute -inset-0.5 bg-primary/20 opacity-0 group-hover:opacity-100 blur transition-opacity pointer-events-none" />
              {down ? (
                <div className="flex gap-4 p-6 bg-destructive/10 border border-destructive text-destructive">
                  <Prohibit size={24} className="shrink-0" />
                  <div>
                    <strong className="block font-mono font-bold uppercase text-lg mb-2">Nothing to show.</strong>
                    <p className="text-xs font-mono leading-relaxed">
                      This slot renders a real passport. The API on port 5055 is not answering. Run `pnpm up`.
                    </p>
                  </div>
                </div>
              ) : hero ? (
                <Passport
                  passport={hero.passport}
                  decision={hero.decision}
                  integrity={hero.integrity}
                  showLog={false}
                  showChecks={false}
                  maxFields={4}
                  showCapabilities={false}
                  showDial={false}
                  mrzRows={1}
                  showHeadBadge={false}
                  compact
                  onOpen={() => onGo('lookup', 'optimizer.kya.eth')}
                />
              ) : (
                <div className="h-[420px] bg-white/5 animate-pulse border border-white/10" />
              )}
            </div>
          </motion.div>
        </section>

        {!down && roster.length > 0 && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
            initial={{opacity: 0}}
            whileInView={{opacity: 1}}
            viewport={{once: true}}
            transition={{duration: 0.2}}
          >
            {[
              {val: totals.agents, label: 'PASSPORTS ISSUED'},
              {val: totals.acts, label: 'WITNESSED ACTIONS'},
              {val: totals.blocked, label: 'BLOCKED ATTEMPTS', color: totals.blocked ? 'text-destructive' : ''},
              {val: roster[0] ? pct(roster[0].score, 1) : '0%', label: 'BEST REPUTATION'},
            ].map((stat, i) => (
              <div key={i} className="bg-black border-2 border-white/10 p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-primary transition-colors">
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 group-hover:bg-primary/10 -rotate-45 translate-x-4 -translate-y-4 transition-colors" />
                <span className={`font-mono text-4xl font-bold tracking-tighter ${stat.color || 'text-white'}`}>{stat.val}</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══ the gap ════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 mb-20 border-t-[6px] border-white/10 pt-16 items-start">
          <div className="lg:sticky lg:top-12 self-start bg-black/80 backdrop-blur p-6 border-l-4 border-primary">
            <h2 className="text-4xl md:text-5xl font-sans font-bold tracking-tighter text-white mb-6 uppercase">
              Three questions,<br/>
              no way to answer them.
            </h2>
            <p className="text-md font-mono text-muted-foreground">
              Agents already browse, negotiate, trade and spend on someone's behalf. Before you hand one a task or a budget, you get to check exactly nothing.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {GAPS.map((g, i) => (
              <motion.div
                key={g.q}
                initial={{opacity: 0, x: 20}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, margin: "-100px"}}
                transition={{delay: i * 0.1, duration: 0.2}}
                className="bg-black border-2 border-white/10 p-6 sm:p-8"
              >
                <div className="flex items-center gap-3 text-primary mb-6 border-b-2 border-white/5 pb-4">
                  <g.icon size={24} weight="fill" />
                  <h3 className="text-lg font-mono font-bold text-white uppercase">{g.q}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="pl-4 border-l-[3px] border-white/20">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">> TODAY</span>
                    <p className="text-sm font-mono text-muted-foreground leading-relaxed">{g.now}</p>
                  </div>
                  <div className="pl-4 border-l-[3px] border-primary">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">> WITH KYA</span>
                    <p className="text-sm font-mono text-white leading-relaxed">{g.kya}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ the loop ══════════════════════════════════════════════════════ */}
        <section id="loop" className="mb-20 border-t-2 border-white/10 pt-16 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl pointer-events-none" />
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-4xl font-sans font-bold tracking-tighter text-white mb-4 uppercase">One request. Six verifiable steps.</h2>
            <p className="text-sm font-mono text-muted-foreground">
              A task-requesting app asks the registry who is accountable, in-mandate and proven. Only then does anything execute, and the receipt comes back through the execution path.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {LOOP.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{opacity: 0, scale: 0.9}}
                whileInView={{opacity: 1, scale: 1}}
                viewport={{once: true}}
                transition={{delay: i * 0.05}}
                className="bg-black border-2 border-white/10 p-4 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <span className="block font-mono text-[10px] font-bold text-primary mb-4">[{String(i + 1).padStart(2, '0')}]</span>
                <s.icon size={28} className="text-white group-hover:text-primary transition-colors mb-3" weight="duotone" />
                <h3 className="text-sm font-mono font-bold text-white mb-2 uppercase">{s.label}</h3>
                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">{s.detail}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="flex items-center gap-4 mt-8 p-6 bg-primary border-2 border-primary rounded-none shadow-[4px_4px_0_0_#ffffff]"
            initial={{opacity: 0, y: 20}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true}}
          >
            <Lightning size={24} className="text-black shrink-0" weight="fill" />
            <p className="text-sm font-mono font-bold text-black flex-1 uppercase">
              The reputation score moves on-chain at the end of that sequence, in front of you. Nothing is cached and nothing is self-reported.
            </p>
            <Button variant="ghost" onClick={() => onGo('relying')} className="text-black hover:text-white hover:bg-black font-mono font-bold text-xs uppercase tracking-wider rounded-none border-2 border-black hover:border-black transition-colors h-10 px-6">
              Run it <ArrowUpRight size={14} className="ml-2" />
            </Button>
          </motion.div>
        </section>
        
        {/* Footer CTA */}
        <section className="mb-8 border-t-2 border-white/10 pt-20 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 pointer-events-none mix-blend-screen">
            <img src="/images/holo.jpg" alt="" className="w-full h-full object-cover rounded-full filter contrast-150 saturate-200" />
          </div>
          <div className="relative z-10 bg-black/60 backdrop-blur p-8 inline-block border-2 border-white/10">
            <h2 className="text-3xl font-sans font-bold tracking-tighter text-white mb-6 uppercase">
              We are not building another AI agent.<br/>
              <span className="text-primary font-mono text-2xl mt-4 block">We are building the layer that lets you trust one.</span>
            </h2>
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Button size="lg" onClick={() => onGo('compare')} className="font-mono uppercase font-bold tracking-widest text-xs rounded-none bg-primary text-black hover:bg-white hover:text-black border-2 border-primary hover:border-white transition-colors h-12 px-8">
                Open console <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => onGo('issue')} className="font-mono uppercase font-bold tracking-widest text-xs rounded-none border-2 border-white/20 hover:bg-white/10 hover:text-white transition-colors h-12 px-8">
                Issue passport
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
