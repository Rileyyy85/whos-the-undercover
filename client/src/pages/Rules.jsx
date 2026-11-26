import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Logo, RoleTag } from '../components/ui.jsx';

const TABS = {
  overview: {
    title: 'Overview',
    body: (
      <>
        <p>
          <b>Who&apos;s the Undercover?</b> is a word-bluffing game for 4–12 players. Everyone joins on their own phone or
          laptop, and the host shares the main screen on Zoom.
        </p>
        <p>
          Most players (the <b className="text-[#8fd0ff]">Civilians</b>) get the same secret word. One or two players (the{' '}
          <b className="text-[#ff8a9b]">Undercover</b>) get a similar but different word. Sometimes there is also a{' '}
          <b className="text-[#dcb4ff]">Mr. White</b> who gets no word at all.
        </p>
        <p>
          Take turns giving a short clue about your word, discuss, then vote someone out. Find the infiltrators before they
          outlast you!
        </p>
        <p className="text-white/60">A round takes about 5–8 minutes. Plan on 5–7 word pairs for a 45-minute session.</p>
      </>
    ),
  },
  roles: {
    title: 'Roles',
    body: (
      <>
        <p>
          <RoleTag role="civilian" /> The majority. Everyone gets the same word (for example <i>Tea</i>).
        </p>
        <p>
          <RoleTag role="undercover" /> Gets a similar word (for example <i>Coffee</i>). 1 Undercover with 4–7 players, 2
          with 8 or more.
        </p>
        <p>
          <RoleTag role="mrwhite" /> Gets no word. Their screen says “You are Mr. White — blend in!”. Only used with 5+
          players.
        </p>
        <p className="rounded-2xl bg-deep/40 p-4">
          🤫 <b>Important:</b> you only see a word, not your role. You don&apos;t know if you&apos;re a Civilian or the
          Undercover. Listen carefully to the others!
        </p>
      </>
    ),
  },
  clues: {
    title: 'Clue tips',
    body: (
      <>
        <p>When it&apos;s your turn, type one word or a short phrase (max 30 characters) on your device.</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Be vague enough that the Undercover can&apos;t guess your word…</li>
          <li>…but clear enough that fellow Civilians trust you.</li>
          <li>Don&apos;t say the word itself, and don&apos;t repeat someone else&apos;s clue.</li>
          <li>If your word seems different from everyone else&apos;s, you might be the Undercover. Blend in!</li>
          <li>Mr. White: listen to the earlier clues and give something safe and general.</li>
        </ul>
      </>
    ),
  },
  voting: {
    title: 'Voting',
    body: (
      <>
        <p>After clues (and an optional discussion), every player still in the game votes on their device.</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>You can&apos;t vote for yourself. You can change your vote until the host reveals the results.</li>
          <li>The main screen shows how many people have voted, but not who voted for whom until the reveal.</li>
          <li>The player with the most votes is eliminated and their role is revealed.</li>
          <li>Tie? The host chooses a re-vote between the tied players, or no elimination this round.</li>
          <li>
            If <b className="text-[#dcb4ff]">Mr. White</b> is eliminated, they get one secret guess at the Civilians&apos;
            word. A correct guess wins the game!
          </li>
        </ul>
      </>
    ),
  },
  winning: {
    title: 'Winning',
    body: (
      <>
        <p>
          <RoleTag role="civilian" /> win when every Undercover and Mr. White has been eliminated.
        </p>
        <p>
          <RoleTag role="undercover" /> win when the infiltrators are at least as many as the Civilians still in the game
          (for example, the final 2 players).
        </p>
        <p>
          <RoleTag role="mrwhite" /> wins by guessing the Civilians&apos; word after being eliminated, or by surviving to the
          end.
        </p>
      </>
    ),
  },
  example: {
    title: 'Example round',
    body: (
      <>
        <p>
          Six players. Civilians have <b className="text-[#8fd0ff]">Tea</b>, the Undercover has{' '}
          <b className="text-[#ff8a9b]">Coffee</b>, and one player is <b className="text-[#dcb4ff]">Mr. White</b>.
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Amy (Civilian): “leaves”</li>
          <li>Ben (Undercover): “morning”</li>
          <li>Chen (Civilian): “cup”</li>
          <li>Dana (Mr. White): “hot” (safe guess from the clues so far)</li>
          <li>Eli (Civilian): “British”</li>
          <li>Fay (Civilian): “green”</li>
        </ol>
        <p>
          “Morning” is a little suspicious… Most vote for Ben. He&apos;s revealed as the Undercover! But Mr. White is still
          hiding, so the game continues with another clue round.
        </p>
      </>
    ),
  },
};

export default function Rules() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(TABS[params.get('tab')] ? params.get('tab') : 'overview');
  const choose = (k) => {
    setTab(k);
    setParams({ tab: k }, { replace: true });
  };
  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <Link to="/">
          <Logo className="text-2xl sm:text-3xl" />
        </Link>
        <Link to="/" className="text-white/60 hover:text-white">
          ← Home
        </Link>
      </div>
      <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">How to Play</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(TABS).map(([k, t]) => (
          <button
            key={k}
            onClick={() => choose(k)}
            className={`rounded-full px-4 py-2 font-bold transition ${tab === k ? 'bg-gold text-grape shadow-[0_4px_0_#c78f00]' : 'bg-white/15 hover:bg-white/25'}`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <Card className="p-6 sm:p-8 text-lg leading-relaxed space-y-4 animate-fade-up" key={tab}>
        {TABS[tab].body}
      </Card>
    </div>
  );
}
