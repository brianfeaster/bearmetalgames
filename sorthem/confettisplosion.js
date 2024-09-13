var ConfettiSplosion = new class {

  confettiCount = 50;
  animationDelay = 50;
  // Array of [confettiElement, descriptor] where descriptor
  // is [X,Y, Xvel,Yvel, Xacc,Yacc, rotationAngle];
  confetti = Array(this.confettiCount);

  rnd = (n)=>Math.floor(Math.random()*n);

  CreateAppendChild = function (tag, parent, text) {
    let e = parent.appendChild(document.createElement(tag));
    if (text != undefined) {
      if (text===" ") { e.innerHTML="&nbsp;" } else { e.innerText=text }
    }
    return e;
  };

  constructor () {
    // Confetti container
    const elConfetti = this.CreateAppendChild("div", document.body);
    elConfetti.style.position = "fixed";
    elConfetti.style.bottom = 0;
    elConfetti.style.left = 0;
    elConfetti.style.fontSize = "50%";
    // Confetti
    this.confetti.fill(0).forEach((_,i)=>{
      const elConfetto = this.CreateAppendChild("p", elConfetti, " ");
      elConfetto.style.backgroundColor = `rgb(${this.rnd(256)},${this.rnd(256)},${this.rnd(256)})`;
      elConfetto.style.position = "absolute";
      elConfetto.style.minWidth = "1em";
      this.confetti[i] = [elConfetto, []];
    });
  }

  resetConfettiState () {
    this.confetti.forEach((desc)=>
      desc[1] = this.rnd(2)
        ?  [0, 0,   (20+this.rnd(150))/5000,(300+this.rnd(200))/5000,  0,-.005,  this.rnd(360)]  // right moving confetti
        :  [1, 0,  -(20+this.rnd(150))/5000,(300+this.rnd(200))/5000,  0,-.005,  this.rnd(360)]); // left moving confetti
  }

  /* Render and calculate/update confetti's descriptors position and velocity values:
     Location is incremented by velocity, velocity incremented by acceleration,
     rotation is linear.
  */
  tick ([el, desc]) {
    el.style.left   = desc[0] * document.body.offsetWidth  + "px";
    el.style.bottom = desc[1] * document.body.offsetHeight + "px";
    el.style.transform = `rotate3d(1,1,1,${desc[6]}deg)`;
    desc[0] += desc[2]; // loc x,y
    desc[1] += desc[3];
    desc[2] += desc[4]; // velocity x,y
    desc[3] += desc[5];
    desc[6] += 20;      // rotation
  }

  // Animate next frame for confetti. Return count still visible on screen.
  tickAll () {
    return this.confetti
      .filter((confetto)=>(this.tick(confetto), -.2<confetto[1][1]))
      .length
  }

  // Animate confetti fullscreen in a parabolic arc
  start () {
    this.resetConfettiState();
    setTimeoutLoop(
      ()=>{ if (!this.tickAll()) { return false; } },
      [this.animationDelay]);
  }

} // Class ConfettiSplosion

