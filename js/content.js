// All CV content lives here. Each "section" is one green pipe in the game.
// Each section is split into "parts" — one info block (!) per part inside the pipe room.

const CV = {
  name: 'Dilyorbek Esonboyev',
  short: 'DILYOR',
  location: 'Guliston, Syrdarya, Uzbekistan',
  email: 'abobusprrtich@gmail.com',
  arduinium: 'https://arduinium.vercel.app',
};

const CERTS = {
  purple: { src: 'assets/certs/purple-comet-view.png', thumb: 'assets/certs/purple-comet-thumb.png' },
  ideathon: { src: 'assets/certs/ideathon-view.png', thumb: 'assets/certs/ideathon-thumb.png' },
  ulugbek: { src: 'assets/certs/ulugbek-view.png', thumb: 'assets/certs/ulugbek-thumb.png' },
};

const LINK_ARDUINIUM = `<a href="${CV.arduinium}" target="_blank" rel="noopener">arduinium.vercel.app ↗</a>`;

const SECTIONS = {
  about: {
    num: 1, label: 'ABOUT', title: 'About Me',
    parts: [
      {
        tag: 'HELLO', title: 'Hello, World!',
        body: `<p>I'm <b>Dilyorbek Esonboyev</b> — a student builder from <b>Guliston, Uzbekistan</b>.</p>
               <p>I make things at the edge of software and hardware: robots, circuits, games, 3D art and the interfaces that tie them together.</p>
               <p class="hint">Tip: every green pipe in this game is one chapter of my CV.</p>`,
      },
      {
        tag: 'LANGUAGES', title: 'Spoken Languages',
        body: `<ul>
                 <li><b>Uzbek</b> — native</li>
                 <li><b>English</b> — advanced (IELTS 7.5)</li>
                 <li><b>Russian</b> — fluent / advanced</li>
               </ul>
               <p>That's also why Arduinium ships in all three.</p>`,
      },
      {
        tag: 'INTERESTS', title: 'What I Love',
        body: `<ul>
                 <li>Game development</li>
                 <li>3D design &amp; modeling</li>
                 <li>Embedded systems &amp; robotics</li>
                 <li>UI/UX design</li>
                 <li>AI &amp; machine learning</li>
                 <li>Cooking &amp; arts</li>
               </ul>`,
      },
    ],
  },

  education: {
    num: 2, label: 'SCHOOL', title: 'Education',
    parts: [
      {
        tag: 'RBIS', title: 'Rustam Bosimov International School',
        body: `<p><b>High School Diploma</b> · Guliston</p>
               <p>Sept 2026 – May 2027 (expected)</p>
               <p class="big">GPA 4.9 / 5.0</p>
               <p>Also one of the pilot schools for Arduinium.</p>`,
      },
      {
        tag: 'BOARDING', title: 'Guliston District Specialized Boarding School',
        body: `<p><b>Secondary Education</b> · Guliston District</p>
               <p>Sept 2022 – May 2026</p>
               <p>Where the math olympiads, the first Arduino projects and the IdeaThon team all started.</p>`,
      },
      {
        tag: 'SCORES', title: 'Test Scores',
        body: `<ul>
                 <li><b>SAT:</b> 1320</li>
                 <li><b>IELTS:</b> 7.5</li>
               </ul>`,
      },
    ],
  },

  skills: {
    num: 3, label: 'SKILLS', title: 'Skills & Tools',
    parts: [
      {
        tag: 'CODE', title: 'Programming Languages',
        body: `<p class="chips"><span>C#</span><span>Python</span><span>C</span><span>C++</span><span>JavaScript</span><span>GDScript</span></p>`,
      },
      {
        tag: 'ENGINES', title: 'Engines & Frameworks',
        body: `<p class="chips"><span>Unity</span><span>Godot 4</span><span>React</span><span>Three.js</span><span>Rapier</span><span>Git</span></p>
               <p>Plus <b>Claude Code</b> and other AI-assisted dev tools for fast prototyping.</p>`,
      },
      {
        tag: 'HARDWARE', title: 'Hardware',
        body: `<p class="chips"><span>Arduino</span><span>ESP32</span><span>LEGO Robotics</span><span>Sensors</span><span>Solar power</span><span>PC building</span></p>`,
      },
      {
        tag: 'CERTS', title: 'Certifications',
        body: `<ul>
                 <li>Coursera — <b>C# Basics</b></li>
                 <li>Coursera — <b>Unity Foundations</b></li>
                 <li>SAT 1320 · IELTS 7.5</li>
               </ul>`,
      },
    ],
  },

  arduinium: {
    num: 4, label: 'ARDUINIUM', title: 'Arduinium — Virtual Robotics Lab',
    parts: [
      {
        tag: 'WHAT', title: 'What is Arduinium?',
        body: `<p><b>Co-Founder &amp; Lead Developer</b> · 2026 – present</p>
               <p>A browser-based <b>3D robotics lab</b>: students build robots, wire Arduino circuits, program them with blocks and test everything in a physics simulation.</p>
               <p>Built for schools that don't have robotics kits or qualified teachers.</p>
               <p class="cta">${LINK_ARDUINIUM}</p>`,
      },
      {
        tag: 'PILOT', title: 'Real Classrooms',
        body: `<p>Piloted at <b>School No. 8</b> and <b>Rustam Bosimov International School</b> in Gulistan.</p>
               <p class="big">~100 student users</p>`,
      },
      {
        tag: 'V1 STACK', title: 'Version 1',
        body: `<p class="chips"><span>React</span><span>Three.js</span><span>Rapier physics</span></p>
               <p>Full <b>build → wire → code → simulate</b> workflow with Arduino Uno, breadboards, LEDs, motor drivers, servos and sensors.</p>`,
      },
      {
        tag: 'MISSIONS', title: 'Guided Missions',
        body: `<ul>
                 <li>Circuit lab onboarding</li>
                 <li>Obstacle &amp; line-following challenges</li>
                 <li>Servo gripper tasks</li>
               </ul>
               <p>Interface in <b>Uzbek, Russian and English</b>.</p>`,
      },
      {
        tag: 'GODOT', title: 'The Godot 4 Rebuild',
        body: `<p>Leading a rebuild in <b>Godot 4</b> with typed GDScript, a <b>custom electrical solver</b> and fixed-tick <b>60 Hz physics</b>.</p>
               <p>Reversed polarity or a short circuit now fails exactly the way it would on real hardware.</p>`,
      },
      {
        tag: 'PLAY IT', title: 'Try It Yourself',
        body: `<p>Arduinium runs right in your browser:</p>
               <p class="cta">${LINK_ARDUINIUM}</p>`,
      },
    ],
  },

  hardware: {
    num: 5, label: 'HW LAB', title: 'Hardware Lab',
    parts: [
      {
        tag: 'IRRIGATE', title: 'Smart Irrigation System (2025)',
        body: `<p class="chips"><span>Arduino</span><span>Soil sensor</span><span>Solar</span></p>
               <ul>
                 <li>Solar-powered prototype built with a teammate — drip irrigation runs <b>only when the soil actually needs water</b>.</li>
                 <li>Automatic tank refill, so it runs without supervision.</li>
                 <li><b>3rd place</b> at the Gulistan IdeaThon.</li>
               </ul>`,
      },
      {
        tag: 'NEXT', title: 'Irrigation: Next Stage',
        body: `<ul>
                 <li>Wind backup power for cloudy days</li>
                 <li>AI models for crop health &amp; soil fertility</li>
                 <li>Targeted pesticide spraying</li>
               </ul>`,
      },
      {
        tag: 'ESP32', title: 'ESP32 Custom Builds (2026)',
        body: `<p class="chips"><span>C</span><span>Embedded</span></p>
               <ul>
                 <li>A full <b>calculator</b> on ESP32 from scratch — input handling, display logic and computation.</li>
                 <li>A custom network-security research tool.</li>
                 <li>Lots of low-level firmware debugging.</li>
               </ul>`,
      },
      {
        tag: 'ROBOTS', title: 'Arduino & LEGO Robotics (2026)',
        body: `<p class="chips"><span>Arduino C++</span><span>LEGO Python</span></p>
               <p>Robots mixing Arduino boards and LEGO parts: sensor-driven behaviors and motor control for autonomous movement, iterated over many build versions.</p>`,
      },
    ],
  },

  experience: {
    num: 6, label: 'WORK', title: 'Experience',
    parts: [
      {
        tag: 'PC TECH', title: 'Freelance PC Technician',
        body: `<p><b>Self-employed</b> · Guliston · 2024 – present</p>
               <ul>
                 <li>Assemble and configure custom PCs to client specs; upgrades, repairs, optimization.</li>
                 <li>Windows installs, reconfiguration and printer hardware repairs.</li>
                 <li>Keep my own school's computers and printers running for students and staff.</li>
               </ul>`,
      },
      {
        tag: 'UI/UX', title: 'UI/UX Contributor — Startup Ventures',
        body: `<p><b>Remote</b> · 2024 – present</p>
               <ul>
                 <li>Led UI/UX design across several early-stage startups.</li>
                 <li>Used Claude Code and AI tools to prototype and iterate fast.</li>
                 <li>Built a quick design → development workflow.</li>
               </ul>`,
      },
      {
        tag: 'FINFLOW', title: 'FinFlow — Frontend Design',
        body: `<p><b>Collaborator</b> · GitHub · 2026</p>
               <p>Frontend design direction and UI/UX suggestions for an open-source financial management and workflow tool.</p>`,
      },
      {
        tag: 'MUNDENIUM', title: 'Mundenium — 3D Asset Artist',
        body: `<p><b>Collaborator</b> · GitHub · 2026</p>
               <p>Modeled and textured environment and prop assets for an independent Unity game and helped bring them into gameplay scenes.</p>`,
      },
    ],
  },

  honors: {
    num: 7, label: 'HONORS', title: 'Hall of Honors',
    parts: [
      {
        tag: 'PURPLE', title: 'Purple Comet! Math Meet — 1st in Uzbekistan',
        cert: 'purple',
        body: `<p><b>1st Place in Uzbekistan</b> · National ranking · 2026</p>
               <p>High School, Mixed Team · Gulistan</p>`,
      },
      {
        tag: 'ULUGBEK', title: '"Mirzo Ulugbek Vorislari" — Winner',
        cert: 'ulugbek',
        body: `<p><b>Winner, district stage</b> · 2025</p>
               <p>Regional academic competition organized by the Ulugbek Foundation, the Ministry of Higher Education, Science and Innovation, and the Sirdaryo district administration.</p>`,
      },
      {
        tag: 'IDEATHON', title: 'Gulistan IdeaThon — 3rd Place',
        cert: 'ideathon',
        body: `<p><b>3rd Place</b> · Regional innovation / startup competition · 2025</p>
               <p>Project: <b>"Smart sug'orish" (Smart Irrigation) system</b>.</p>`,
      },
    ],
  },

  leadership: {
    num: 8, label: 'LEAD', title: 'Leadership & Activities',
    parts: [
      {
        tag: 'HACKATHON', title: 'National AI Hackathon (2026)',
        body: `<p><b>Team Supervisor &amp; Frontend Designer</b> · Guliston</p>
               <p>Supervised a dev team and led frontend/UI while prototyping an AI solution under strict deadlines.</p>`,
      },
      {
        tag: 'FEST', title: 'Startup Fest Guliston',
        body: `<p><b>Volunteer</b> · 2025 – 2026</p>
               <p>Helped organize the regional Startup Fest and support the local startup ecosystem.</p>`,
      },
      {
        tag: '3D CLUB', title: '3D Art & Design Club',
        body: `<p><b>Member</b> · present</p>
               <p>3D modeling and visual design practice, applied to independent game assets.</p>`,
      },
    ],
  },
};

const SECTION_ORDER = ['about', 'education', 'skills', 'arduinium', 'hardware', 'experience', 'honors', 'leadership'];

const CONTACT_HTML = `
  <p>Thanks for playing through my CV!</p>
  <ul>
    <li>Email: <a href="mailto:${CV.email}">${CV.email}</a></li>
    <li>Arduinium: ${LINK_ARDUINIUM}</li>
    <li>Based in ${CV.location}</li>
  </ul>`;
