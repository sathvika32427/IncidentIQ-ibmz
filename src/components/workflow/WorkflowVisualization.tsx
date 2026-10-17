import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Play, Pause, RotateCcw, ChevronRight, Layers, ShieldCheck, CheckCircle2, XCircle, ArrowUpRight, Database, Terminal } from 'lucide-react';

interface Stage {
  id: number;
  title: string;
  role: string;
  summary: string;
  icon: string;
  color: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: '1. Employee Symptom Report',
    role: 'Employee / Reporter',
    summary: 'Employee observes anomalous service behavior (e.g., repeated login timeouts or cron errors) and submits title, description, and affected partition.',
    icon: '👤',
    color: '#38bdf8'
  },
  {
    id: 2,
    title: '2. Incident Registration & Schema Validation',
    role: 'IncidentIQ Platform',
    summary: 'System persists incident in SQLite, assigns unique INC-Z ID, and triggers event-driven notifications for high/critical severities.',
    icon: '⚡',
    color: '#06b6d4'
  },
  {
    id: 3,
    title: '3. Log Evidence Extraction',
    role: 'Security Analyst',
    summary: 'Analyst inspects LogHub Linux 2k dataset, filters by daemon component (sshd, logrotate, klogind), and links specific log lines as supporting evidence.',
    icon: '📜',
    color: '#3b82f6'
  },
  {
    id: 4,
    title: '4. Keyword-Based Similarity Search',
    role: 'Recommendation Engine',
    summary: 'Keyword-frequency cosine score compares stored incidents and shows matching terms. Past actions and outcomes are human-review references, not guaranteed fixes.',
    icon: '🧠',
    color: '#6366f1'
  },
  {
    id: 5,
    title: '5. Analyst Investigation & Action Recording',
    role: 'Security Analyst',
    summary: 'Analyst records technical investigation actions in chronological order, capturing commands executed and observed system reactions.',
    icon: '🛠️',
    color: '#0ea5e9'
  },
  {
    id: 6,
    title: '6. Outcome Recording (Success vs Failed Attempts)',
    role: 'Security Analyst',
    summary: 'Critically tracks which actions succeeded and which failed with mandatory failure root causes to prevent future recurrence of dead-end procedures.',
    icon: '⚖️',
    color: '#f59e0b'
  },
  {
    id: 7,
    title: '7. Human Escalation Review',
    role: 'Incident Manager',
    summary: 'If cross-partition or senior authority is required, analyst escalates. Manager evaluates evidence and formally Approves, Returns, or Rejects.',
    icon: '🛡️',
    color: '#a855f7'
  },
  {
    id: 8,
    title: '8. Verified Resolution & Evidence Audit',
    role: 'Security Analyst',
    summary: 'Analyst records verified fix summary, links post-fix verification telemetry, and marks incident resolved, stopping the resolution clock.',
    icon: '✅',
    color: '#10b981'
  },
  {
    id: 9,
    title: '9. Reusable Incident Memory Generation',
    role: 'Incident Memory Bank',
    summary: 'Proven fix is indexed in the Reusable Knowledge Base, ready to provide instant verified guidance when the next similar incident arises.',
    icon: '💾',
    color: '#06b6d4'
  }
];

export const WorkflowVisualization: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Three.js animation setup
  useEffect(() => {
    if (viewMode !== '3d' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 480;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.035);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight.position.set(5, 12, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const purpleLight = new THREE.DirectionalLight(0xa855f7, 1.2);
    purpleLight.position.set(-6, 8, -5);
    scene.add(purpleLight);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(24, 24, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // Create 9 Node Platforms in an Isometric S-Curve / Ring
    const nodeGroup = new THREE.Group();
    const nodeMeshes: THREE.Mesh[] = [];

    STAGES.forEach((stage, idx) => {
      // Calculate position in isometric flow
      const angle = (idx / STAGES.length) * Math.PI * 2;
      const radius = 5.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * (radius * 0.7);
      const y = Math.sin(idx * 0.6) * 0.4;

      // Platform Cylinder
      const cylGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.35, 32);
      const cylMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(stage.color),
        metalness: 0.6,
        roughness: 0.3,
        emissive: new THREE.Color(stage.color),
        emissiveIntensity: 0.15
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(x, y, z);
      cylMesh.castShadow = true;
      cylMesh.receiveShadow = true;
      (cylMesh as any).stageId = stage.id;

      // Floating Orb over platform
      const orbGeo = new THREE.SphereGeometry(0.32, 24, 24);
      const orbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(stage.color),
        metalness: 0.8,
        roughness: 0.2,
        emissive: new THREE.Color(stage.color),
        emissiveIntensity: 0.4
      });
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.position.set(0, 0.7, 0);
      cylMesh.add(orbMesh);

      nodeGroup.add(cylMesh);
      nodeMeshes.push(cylMesh);
    });

    scene.add(nodeGroup);

    // Conduit flow curve connecting nodes
    const curvePoints: THREE.Vector3[] = nodeMeshes.map(m => m.position.clone());
    curvePoints.push(nodeMeshes[0].position.clone());
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.06, 8, true);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.35 });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // Traveling Data Particle
    const particleGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const particleMesh = new THREE.Mesh(particleGeo, particleMat);
    scene.add(particleMesh);

    // Animation Loop
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Slowly rotate the entire pipeline
      nodeGroup.rotation.y = time * 0.12;
      tubeMesh.rotation.y = time * 0.12;

      // Position particle along curve
      const t = (time * 0.1) % 1;
      const pos = curve.getPointAt(t);
      particleMesh.position.copy(pos);
      particleMesh.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), nodeGroup.rotation.y);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [viewMode]);

  // Auto-play through stages
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStage(prev => (prev % STAGES.length) + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentStageObj = STAGES.find(s => s.id === activeStage) || STAGES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            IncidentIQ Lifecycle & 3D Workflow Architecture
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visual model demonstrating the relationship between IBM Z system log evidence, investigation actions, human review, and persistent incident memory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: 3D vs 2D */}
          <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                viewMode === '3d' ? 'bg-cyan-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Interactive 3D Scene
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                viewMode === '2d' ? 'bg-cyan-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D Architecture Diagram
            </button>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-cyan-300 transition-colors"
            title={isPlaying ? 'Pause Auto-Advance' : 'Play Auto-Advance'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage Box */}
      {viewMode === '3d' ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0f1d] shadow-2xl">
          {/* Canvas Mount */}
          <div ref={mountRef} className="w-full h-[460px]" />

          {/* Unified Bottom Control Dock (collapsible, zero viewport clutter per threejs guidelines) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-4xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{currentStageObj.icon}</span>
                <span className="font-mono text-cyan-400 text-xs font-bold uppercase">{currentStageObj.role}</span>
                <span className="text-slate-600">·</span>
                <h4 className="text-sm font-bold text-slate-100">{currentStageObj.title}</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                {currentStageObj.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveStage(prev => (prev === 1 ? STAGES.length : prev - 1))}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100"
              >
                Previous
              </button>
              <button
                onClick={() => setActiveStage(prev => (prev % STAGES.length) + 1)}
                className="px-3.5 py-1 text-xs font-semibold rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                Next Step
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2D Fallback Diagram */
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">2D Linear Investigation Flow</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STAGES.map((stage) => {
              const isCurrent = stage.id === activeStage;
              return (
                <div
                  key={stage.id}
                  onClick={() => setActiveStage(stage.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg text-slate-100'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-base">{stage.icon}</span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">{stage.role}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">{stage.title}</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">{stage.summary}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step Pills Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveStage(s.id)}
            className={`py-2 px-1 text-center rounded-xl border text-[11px] font-mono transition-colors truncate ${
              s.id === activeStage
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Step {s.id}
          </button>
        ))}
      </div>
    </div>
  );
};
