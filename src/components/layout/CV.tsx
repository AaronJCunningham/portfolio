import Link from "next/link";
import type { ReactNode } from "react";

type CVProps = {
  children?: ReactNode;
};

export const CV = ({ children }: CVProps) => {
  return (
    <div id="bio" className="bio_content">
      <div className="section-meta">
        <span className="section-meta__index">{"//06"}</span>
        <span className="section-meta__label">ABOUT ME</span>
      </div>
      <div className="bio-links">
        <a href="https://github.com/AaronJCunningham" target="_blank" rel="noreferrer">GITHUB</a>
        <span className="bio-links__separator">|</span>
        <a href="https://twitter.com/aaron_1337" target="_blank" rel="noreferrer">TWITTER</a>
        <span className="bio-links__separator">|</span>
        <Link href="/contact" className="bio-links__contact">
          CONTACT
        </Link>
      </div>
      {children}
      <p>
        I'm a Lead Full-Stack Developer & Creative Technologist. I build
        ambitious products end to end across architecture, frontend, backend,
        real-time systems, and immersive 3D. Everything I build works and looks
        right, backed by 7 years of development and 10 years of professional
        design.
      </p>

      <p>
        From 2024–2026, I was lead developer at BASEDAI, where I
        single-handedly built the entire product suite:{" "}
        <a
          href="https://basedai-nexus.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Nexus
        </a>{" "}
        — a real-time 3D blockchain visualization rendering on-chain node data
        as an interactive Fibonacci spiral;{" "}
        <a
          href="https://defi-launchpad-jade.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          DeFi Launchpad
        </a>{" "}
        — a decentralized incubation platform with a large system of interconnected Solidity smart contracts
        using EIP-1167 cloneable factories, escrow funding, milestone
        governance, and a staking position marketplace; and{" "}
        <a
          href="https://github.com/AaronJCunningham/based-gecko"
          target="_blank"
          rel="noopener noreferrer"
        >
          Based Gecko
        </a>{" "}
        — a full-stack token monitoring platform with real-time price charts
        from on-chain Uniswap data, WebSocket-powered community features, and
        Ethereum wallet authentication.
      </p>

      <p>
        Previously, I was lead Three.js developer at{" "}
        <a href="https://montra.com" target="_blank" rel="noopener noreferrer">
          Montra
        </a>
        , a browser-based video editing platform built with React Three Fiber.
        From 2020–2023, I led development at{" "}
        <a
          href="https://xeleven.tech"
          target="_blank"
          rel="noopener noreferrer"
        >
          XELEVEN
        </a>
        , a metaverse studio delivering immersive experiences for clients
        including{" "}
        <a
          href="https://theface.com/tiffany-calvers-world"
          target="_blank"
          rel="noopener noreferrer"
        >
          Nike
        </a>
        . Our project{" "}
        <a
          href="https://www.spiritrealm.art"
          target="_blank"
          rel="noopener noreferrer"
        >
          Spirit Realm
        </a>{" "}
        — a browser-based 3D metaverse with custom third-person controls,
        real-time multiplayer, and Web3 NFT minting — was featured at NFT NYC
        in Times Square.
      </p>

      <p>
        I came into tech through design and blockchain — starting at{" "}
        <a
          href="https://coinsquare.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Coinsquare
        </a>{" "}
        in 2014, then joining{" "}
        <a href="https://iost.io" target="_blank" rel="noopener noreferrer">
          IOST
        </a>{" "}
        where I was hired for my design and writing background and rose to Head
        of Growth, Europe. It was at IOST that I started building frontend code
        through an education fund, discovered I loved coding more than
        marketing, and made the switch. By 2020 I was lead developer at
        XELEVEN. I've spoken at{" "}
        <Link href="https://www.aaronjcunningham.com/chainlink-in-berlin">
          Chainlink HQ in Berlin
        </Link>{" "}
        and{" "}
        <Link href="https://www.aaronjcunningham.com/google-campus-warsaw">
          Google Campus in Warsaw
        </Link>
        .
      </p>

      <p>
        I use Claude Code, OpenClaw, and Hermes in structured agentic workflows
        for planning, implementation, and review, with human verification
        before release.
      </p>

      <p>
        Beyond tech, my background in music includes five Billboard Top-20
        tracks, features in VICE and BoilerRoom, and nominations at the
        Oberhausen Film Festival and Prism Prize Awards.
      </p>

      <p>
        I also use{" "}
        <a
          href="https://openclaw.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenClaw
        </a>{" "}
        to run an autonomous agent that creates shader art and generative visuals.
        The results have been pretty cool so far. Check it out in the{" "}
        <Link href="https://aaronjcunningham.com/mauve-zone">Mauve Zone</Link>.
      </p>
    </div>
  );
};
