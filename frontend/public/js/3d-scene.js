// ══════════════════════════════════════════
// ULTRA-MODERN 3D SCENE — 2025 Aesthetic
// Morphing Noise Blob + Neural Network + Particles
// ══════════════════════════════════════════

const VERT_BLOB = `
  vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute4(vec4 x){return mod289v4(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.7928429-0.8537347*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute4(permute4(permute4(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  uniform float uTime;
  varying vec3 vNorm;
  varying float vNoise;
  void main(){
    vec3 pos=position;
    float n=snoise(pos*1.2+uTime*.25);
    n+=snoise(pos*2.5-uTime*.18)*.5;
    n+=snoise(pos*5.+uTime*.35)*.25;
    pos+=normal*n*.55;
    vNoise=n;
    vNorm=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
  }
`;

const FRAG_BLOB = `
  uniform float uTime;
  varying vec3 vNorm;
  varying float vNoise;
  void main(){
    vec3 gold=vec3(.77,.63,.35);
    vec3 blue=vec3(.27,.4,1.);
    vec3 cyan=vec3(.2,.9,1.);
    float fresnel=pow(1.-abs(dot(vNorm,vec3(0.,0.,1.))),2.5);
    vec3 col=mix(gold,blue,vNoise*.5+.5);
    col=mix(col,cyan,fresnel*.7);
    float shimmer=sin(vNoise*10.+uTime*1.5)*.15;
    col+=shimmer*vec3(.6,.9,1.);
    gl_FragColor=vec4(col,.82+fresnel*.18);
  }
`;

class Scene3D {
  constructor() {
    this.canvas = document.getElementById('canvas-3d');
    if (!this.canvas) return;
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(60, this.W / this.H, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(this.W, this.H, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.mouse   = { x: 0, y: 0 };
    this.mouseTgt= { x: 0, y: 0 };
    this.scrollY = 0;
    this.scrollSmooth = 0;
    this.t       = 0;
    this._init();
  }

  _init() {
    this.camera.position.set(0, 0, 5.5);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const pl1 = new THREE.PointLight(0xc5a059, 8, 40); pl1.position.set(6, 8, 6);
    const pl2 = new THREE.PointLight(0x4466ff, 6, 40); pl2.position.set(-8, -4, 4);
    const pl3 = new THREE.PointLight(0x00ffcc, 3, 20); pl3.position.set(0, -6, 2);
    this.scene.add(pl1, pl2, pl3);

    this._buildBlob();
    this._buildNeuralNet();
    this._buildParticleField();
    this._buildHoloGrid();

    window.addEventListener('resize', () => this._resize());
    window.addEventListener('mousemove', e => {
      this.mouseTgt.x = (e.clientX / this.W - .5) * 2;
      this.mouseTgt.y = -(e.clientY / this.H - .5) * 2;
    });
    window.addEventListener('scroll', () => { 
      this.scrollY = window.scrollY; 
      const nav = document.querySelector('.l-nav');
      if (nav) {
        if (window.scrollY > 40) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }
      }
    });


    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      this._scrollReveal();
    }
    this._loop();
  }

  _buildBlob() {
    const geo = new THREE.SphereGeometry(1.5, 128, 128);
    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT_BLOB,
      fragmentShader: FRAG_BLOB,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      side: THREE.FrontSide,
    });
    this.blob = new THREE.Mesh(geo, mat);
    this.blob.position.set(1.8, 0.2, 0);
    this.scene.add(this.blob);

    // Outer wireframe shell
    const wgeo = new THREE.SphereGeometry(1.65, 32, 32);
    const wmat = new THREE.MeshBasicMaterial({ color: 0x4488ff, wireframe: true, transparent: true, opacity: 0.07 });
    this.blobWire = new THREE.Mesh(wgeo, wmat);
    this.blobWire.position.copy(this.blob.position);
    this.scene.add(this.blobWire);
  }

  _buildNeuralNet() {
    const NODE_COUNT = 70;
    const CONNECT_DIST = 3.2;
    const nodes = [];
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xc5a059, transparent: true, opacity: 0.85 });
    const nodeGeo = new THREE.SphereGeometry(0.035, 8, 8);

    for (let i = 0; i < NODE_COUNT; i++) {
      const m = new THREE.Mesh(nodeGeo, nodeMat);
      m.position.set(
        (Math.random() - .5) * 14,
        (Math.random() - .5) * 10,
        (Math.random() - .5) * 8
      );
      this.scene.add(m);
      nodes.push(m);
    }
    this.networkNodes = nodes;

    // Build edges
    this.edges = [];
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4466ff, transparent: true, opacity: 0.18 });
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const d = nodes[i].position.distanceTo(nodes[j].position);
        if (d < CONNECT_DIST) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            nodes[i].position,
            nodes[j].position
          ]);
          const line = new THREE.Line(geo, lineMat.clone());
          this.scene.add(line);
          this.edges.push({ line, d });
        }
      }
    }
  }

  _buildParticleField() {
    const COUNT = 2000;
    const pos   = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - .5) * 22;
      pos[i * 3 + 1] = (Math.random() - .5) * 16;
      pos[i * 3 + 2] = (Math.random() - .5) * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe2c28f, size: 0.04, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _buildHoloGrid() {
    const geo = new THREE.PlaneGeometry(18, 18, 60, 60);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4466ff, wireframe: true, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.holoGrid = new THREE.Mesh(geo, mat);
    this.holoGrid.rotation.x = -Math.PI / 2.2;
    this.holoGrid.position.y = -4;
    this.scene.add(this.holoGrid);
  }

  _scrollReveal() {
    gsap.utils.toArray('.l-feat-card').forEach((el, i) => {
      gsap.fromTo(el, 
        { y: 80, opacity: 0, scale: 0.9, filter: 'blur(10px)' },
        { scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }, y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1, delay: i * 0.15, ease: 'power4.out' }
      );
    });
    gsap.utils.toArray('.l-stat-card').forEach((el, i) => {
      gsap.fromTo(el, 
        { y: 60, opacity: 0, scale: 0.8, filter: 'blur(10px)' },
        { scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }, y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, delay: i * 0.12, ease: 'back.out(1.4)' }
      );
    });
    gsap.utils.toArray('.l-sec-hdr').forEach(el => {
      gsap.fromTo(el, 
        { y: 40, opacity: 0, filter: 'blur(8px)' },
        { scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }, y: 0, opacity: 1, filter: 'blur(0px)', duration: 1, ease: 'power3.out' }
      );
    });
    
    // Parallax hero on scroll
    gsap.to('.l-hero-content', {
      scrollTrigger: { trigger: '.l-hero', start: 'top top', end: 'bottom top', scrub: true },
      y: 100,
      opacity: 0.3
    });
    gsap.to('.l-hero-visual', {
      scrollTrigger: { trigger: '.l-hero', start: 'top top', end: 'bottom top', scrub: true },
      y: 150,
      opacity: 0.3
    });
  }


  _resize() {
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.W, this.H, false);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    const appEl = document.getElementById('app');
    const canvas = document.getElementById('canvas-3d');
    if (appEl && canvas) {
      if (appEl.style.display === 'block' || appEl.style.display === 'flex') {
        canvas.style.display = 'none';
        return;
      } else {
        canvas.style.display = 'block';
      }
    }

    this.t += 0.01;
    const t = this.t;


    // Smooth scroll interpolation
    this.scrollSmooth += (this.scrollY - this.scrollSmooth) * 0.06;

    // Smooth mouse
    this.mouse.x += (this.mouseTgt.x - this.mouse.x) * 0.04;
    this.mouse.y += (this.mouseTgt.y - this.mouse.y) * 0.04;

    // Camera parallax
    this.camera.position.x += (this.mouse.x * 1.5 - this.camera.position.x) * 0.035;
    this.camera.position.y += (this.mouse.y * 0.9 - this.camera.position.y) * 0.035;
    this.camera.position.z = 5.5 + this.scrollSmooth * 0.003;
    this.camera.lookAt(0, 0, 0);

    // Blob morph
    if (this.blob) {
      this.blob.material.uniforms.uTime.value = t;
      this.blob.rotation.y = t * 0.12;
      this.blob.rotation.x = t * 0.07;
      this.blobWire.rotation.copy(this.blob.rotation);
      this.blobWire.rotation.y -= 0.3;
    }

    // Neural net pulse
    if (this.edges) {
      this.edges.forEach((e, i) => {
        e.line.material.opacity = 0.08 + Math.abs(Math.sin(t * 0.8 + i * 0.15)) * 0.25;
      });
      this.networkNodes.forEach((n, i) => {
        n.position.y += Math.sin(t * 0.6 + i * 0.8) * 0.002;
      });
    }

    // Particles drift
    if (this.particles) {
      this.particles.rotation.y = t * 0.015;
      this.particles.rotation.x = this.scrollSmooth * 0.0006;
    }

    // Holo grid wave
    if (this.holoGrid) {
      const pos = this.holoGrid.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, Math.sin(x * 0.6 + t * 0.7) * 0.25 + Math.sin(z * 0.4 + t * 0.5) * 0.2);
      }
      pos.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app3D = new Scene3D(); });
