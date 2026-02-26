import './style.css';
import { createIcons, icons } from 'lucide';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="relative min-h-screen flex flex-col bg-gradient-radial overflow-hidden">
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 glass border-b transition-all duration-300">
      <div class="container mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2 group cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105">
            N
          </div>
          <span class="font-semibold text-lg tracking-tight">NextClaw</span>
        </div>
        <nav class="hidden md:flex gap-8 text-sm font-medium">
          <a href="#features" class="text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          <a href="https://docs.nextclaw.io" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
        </nav>
        <div class="flex items-center gap-4">
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary">
            <i data-lucide="github" class="w-5 h-5"></i>
          </a>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <main class="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 z-10">
      <h1 class="text-5xl md:text-7xl font-bold tracking-tight text-gradient max-w-4xl mb-6 animate-slide-up opacity-0" style="animation-delay: 0.2s">
        The effortlessly simple <br /> Personal AI Assistant.
      </h1>
      
      <p class="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-slide-up opacity-0" style="animation-delay: 0.3s">
        Feature-rich, OpenClaw-compatible gateway. Multi-provider, multi-channel capabilities with an elegant zero-config interface. 
      </p>
      
      <!-- Terminal Block -->
      <div class="w-full max-w-2xl mx-auto mb-10 text-left animate-slide-up opacity-0" style="animation-delay: 0.4s">
        <div class="rounded-2xl overflow-hidden bg-[#332c28] shadow-2xl border border-white/5">
          <div class="flex items-center justify-between px-4 py-3 bg-[#2c2522]">
            <div class="flex gap-2">
              <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            </div>
            <div class="text-xs text-[#a0938a] font-mono">nextclaw - bash</div>
            <button id="copy-btn" class="text-[#a0938a] hover:text-white transition-colors" title="Copy commands">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
          <div id="terminal-content" class="p-6 font-mono text-sm sm:text-base leading-relaxed">
            <div class="flex items-center text-[#d4c8be]">
              <span class="text-[#8eb079] mr-2">~</span>
              <span class="text-[#e29e57] mr-2 font-bold">$</span>
              <span id="install-cmd"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row justify-center gap-4 mb-20 animate-slide-up opacity-0" style="animation-delay: 0.5s">
        <a href="https://docs.nextclaw.io" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-xl shadow-primary/25 focus:ring-2 focus:ring-primary focus:outline-none text-lg">
          <i data-lucide="book-open" class="w-5 h-5"></i>
          Read the Docs
        </a>
        <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-medium bg-foreground text-background hover:bg-foreground/90 transition-all hover:scale-105 shadow-sm focus:ring-2 focus:ring-foreground focus:outline-none text-lg">
          <i data-lucide="github" class="w-5 h-5"></i>
          View on GitHub
        </a>
      </div>

      <!-- Hero Visual -->
      <div class="relative w-full max-w-5xl mx-auto animate-fade-in opacity-0" style="animation-delay: 0.6s">
        <div class="absolute inset-0 bg-primary/10 blur-[100px] rounded-full"></div>
        <div class="glass-card rounded-2xl overflow-hidden border border-border/50 shadow-2xl animate-float">
          <div class="w-full bg-background flex flex-col">
            <!-- Mac window control -->
            <div class="h-10 border-b flex items-center px-4 gap-2 bg-background/80 shrink-0">
              <div class="w-3 h-3 rounded-full bg-red-400"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div class="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <!-- Actual Screenshot -->
            <img src="/nextclaw-ui.png" alt="NextClaw Web Interface" class="w-full h-auto object-cover border-t border-border/40" />
          </div>
        </div>
      </div>
    </main>

    <!-- Features Section -->
    <section id="features" class="relative py-24 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="text-center mb-16 animate-slide-up opacity-0 relative" style="animation-delay: 0.1s">
        <h2 class="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything you need.</h2>
        <p class="text-muted-foreground text-lg max-w-2xl mx-auto">A powerful core wrapped in a seamless interface. Run NextClaw locally or expose it safely.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Feature 1 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.2s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="layers" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Zero-Config UI</h3>
          <p class="text-muted-foreground leading-relaxed">Manage your providers, models, and agents from an elegant dashboard. No hunting through JSON files.</p>
        </div>

        <!-- Feature 2 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.3s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="cpu" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Multi-Provider</h3>
          <p class="text-muted-foreground leading-relaxed">OpenRouter, OpenAI, vLLM, DeepSeek, MiniMax, and more. Easily switch between intelligent backends.</p>
        </div>

        <!-- Feature 3 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.4s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="message-square" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Multi-Channel</h3>
          <p class="text-muted-foreground leading-relaxed">Connect to Telegram, Discord, Feishu, Slack, and WhatsApp. Turn NextClaw into your omni-channel gateway.</p>
        </div>

        <!-- Feature 4 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.5s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="blocks" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">OpenClaw Compatible</h3>
          <p class="text-muted-foreground leading-relaxed">Full compatibility with the OpenClaw plugin ecosystem. Bring your existing extensions without modifications.</p>
        </div>

        <!-- Feature 5 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.6s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="clock" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Automation Built-in</h3>
          <p class="text-muted-foreground leading-relaxed">Powerful Cron and Heartbeat systems allow your AI assistant to run scheduled autonomous tasks globally.</p>
        </div>

        <!-- Feature 6 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.7s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="zap" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Local & Private</h3>
          <p class="text-muted-foreground leading-relaxed">Runs entirely on your machine. Keep your configurations, chat history, and tokens safe natively.</p>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="py-24 px-6 z-10 w-full max-w-4xl mx-auto text-center">
      <div class="glass-card rounded-[2rem] p-12 relative overflow-hidden">
        <div class="absolute inset-0 bg-primary/5"></div>
        <div class="relative z-10">
          <h2 class="text-3xl md:text-5xl font-bold mb-6">Ready to upgrade your AI?</h2>
          <p class="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">Get started with NextClaw in seconds. One command and your local gateway is fully operational.</p>
          <a href="https://docs.nextclaw.io" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-xl shadow-primary/20 focus:ring-2 focus:ring-primary focus:outline-none text-lg">
            View Documentation
            <i data-lucide="arrow-right" class="w-5 h-5 ml-1"></i>
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="w-full border-t border-border/40 py-10 z-10 bg-background/50 backdrop-blur-sm mt-auto">
      <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-2 opacity-80">
          <div class="w-6 h-6 rounded bg-foreground flex items-center justify-center text-background font-bold text-xs">N</div>
          <span class="font-medium text-sm">NextClaw Project</span>
        </div>
        <div class="text-sm text-muted-foreground">
          Released under the MIT License.
        </div>
        <div class="flex gap-4">
          <a href="https://docs.nextclaw.io" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          <a href="https://www.npmjs.com/package/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">NPM</a>
        </div>
      </div>
    </footer>
    
    <!-- Decorative background elements -->
    <div class="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
      <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]"></div>
      <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]"></div>
    </div>
  </div>
`;

// Initialize Lucide icons
createIcons({
  icons,
  nameAttr: 'data-lucide'
});

// Terminal animation
const terminalContent = document.getElementById('terminal-content');
const installCmd = document.getElementById('install-cmd');

if (terminalContent && installCmd) {
  const commands = [
    { text: 'npm install -g nextclaw', delay: 0 },
  ];

  const startupSequence = [
    { text: 'nextclaw start', isCommand: true },
    { text: 'NextClaw v0.8.19 started', icon: '✓', color: '#8eb079' },
    { text: 'UI:  http://127.0.0.1:18791', icon: '→', color: '#7eb6d4' },
    { text: 'API: http://127.0.0.1:18791/api', icon: '→', color: '#7eb6d4' },
  ];

  async function typeText(element: HTMLElement, text: string, speed = 50) {
    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      await new Promise(resolve => setTimeout(resolve, speed));
    }
  }

  async function addLine(content: { text: string; icon?: string; color?: string; isCommand?: boolean }) {
    const line = document.createElement('div');
    line.className = 'flex items-center mt-3';

    if (content.isCommand) {
      line.innerHTML = `
        <span class="text-[#8eb079] mr-2">~</span>
        <span class="text-[#e29e57] mr-2 font-bold">$</span>
        <span class="text-[#d4c8be]"></span>
      `;
      terminalContent?.appendChild(line);
      const textSpan = line.querySelector('span:last-child') as HTMLElement;
      await typeText(textSpan, content.text, 40);
    } else if (content.icon) {
      line.innerHTML = `
        <span class="mr-2 font-bold" style="color: ${content.color}">${content.icon}</span>
        <span style="color: ${content.color}"></span>
      `;
      terminalContent?.appendChild(line);
      await new Promise(resolve => setTimeout(resolve, 100));
      const textSpan = line.querySelector('span:last-child') as HTMLElement;
      textSpan.textContent = content.text;
    }
  }

  async function addCursor() {
    const cursorLine = document.createElement('div');
    cursorLine.className = 'flex items-center mt-3';
    cursorLine.innerHTML = `
      <span class="text-[#8eb079] mr-2">~</span>
      <span class="text-[#e29e57] mr-2 font-bold">$</span>
      <span class="terminal-cursor"></span>
    `;
    terminalContent?.appendChild(cursorLine);
  }

  async function runAnimation() {
    await typeText(installCmd!, commands[0].text, 40);
    await new Promise(resolve => setTimeout(resolve, 800));

    // Run startup sequence
    for (const item of startupSequence) {
      await addLine(item);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Add blinking cursor
    await addCursor();
  }

  // Start animation after a short delay
  setTimeout(runAnimation, 600);
}

// Copy functionality
const copyBtn = document.getElementById('copy-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('npm install -g nextclaw && nextclaw start');

      // Visual feedback
      const originalIcon = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-[#27c93f]"></i>';
      createIcons({ icons, nameAttr: 'data-lucide' });

      setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
        createIcons({ icons, nameAttr: 'data-lucide' });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });
}
