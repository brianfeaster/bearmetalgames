var confettiSplosion = new class {

  confettiCount = 50;
  animationDelay = 50;
  // Array of [confettiElement, descriptor] where descriptor
  // is [X,Y, Xvel,Yvel, Xacc,Yacc, rotationAngle];
  confetti;

  /* Call fn periodically with args where args[0] specifies delay.
     Fn must return array with next call's arguments or undefined
     (to use initial args) to continue iteration.
     Iteration halts if fn returns false or an invalid args array.
  */
  setTimeoutLoop (fn, args) {
    const then = Date.now();
    let nextArgs = fn(...args);
    if (undefined === nextArgs) { nextArgs = args; }
    if (Array.isArray(nextArgs) && nextArgs.length) {
      const duration = Date.now() - then;
      let delay = nextArgs[0]
      // Zero delay if past desired delay time
      delay = duration < delay ? delay-duration : 0;
      setTimeout(this.setTimeoutLoop.bind(this, fn, nextArgs), delay);
    }
  }

  resetConfettiState () {
    const rnd = (n)=>Math.floor(Math.random()*n);
    this.confetti.forEach((desc)=>
      desc[1] = rnd(2)
        ?  [0, 0,   (20+rnd(150))/5000,(300+rnd(200))/5000,  0,-.005,  rnd(360)]  // right moving confetti
        :  [1, 0,  -(20+rnd(150))/5000,(300+rnd(200))/5000,  0,-.005,  rnd(360)]); // left moving confetti
  }

  /* Render and calculate/update confetti's descriptors position and velocity values:
     Location is incremented by velocity, velocity incremented by acceleration,
     rotation is linear.
  */
  tick ([el, desc]) {
    el.style.left   = desc[0] * window.innerWidth  + "px";
    el.style.bottom = desc[1] * window.innerHeight + "px";
    el.style.transform = `rotate3d(1,1,1,${desc[6]}deg)`;
    desc[0] += desc[2]; // loc x,y
    desc[1] += desc[3];
    desc[2] += desc[4]; // velocity x,y
    desc[3] += desc[5];
    desc[6] += 20;      // rotation
  }

  // Animate next frame for confetti. Return count still visible on screen.
  tickAll () {
    return this.confetti.filter((confetto)=>(this.tick(confetto), -.2<confetto[1][1]))
    .length
  }

  CreateAppendChild = function (tag, parent, text) {
    let e = parent.appendChild(document.createElement(tag));
    if (text != undefined) {
      if (text===" ") {
        e.innerHTML = "&nbsp;"
      } else {
        e.innerText = text
      }
    }
    return e;
  };

  init () {
    const rnd = (n)=>Math.floor(Math.random()*n);
    // Confetti container
    const elConfetti = this.CreateAppendChild("div", document.body);
    elConfetti.style.position = "fixed";
    elConfetti.style.bottom = 0;
    elConfetti.style.left = 0;
    elConfetti.style.fontSize = "50%";
    // Confetti
    this.confetti = Array(this.confettiCount);
    this.confetti.fill(0).forEach((_,i)=>{
      const elConfetto = this.CreateAppendChild("p", elConfetti, " ");
      elConfetto.style.backgroundColor = `rgb(${rnd(256)},${rnd(256)},${rnd(256)})`;
      elConfetto.style.position = "absolute";
      elConfetto.style.minWidth = "1em";
      this.confetti[i] = [elConfetto, []];
    });
  }

  // Animate confetti fullscreen
  start () {
    this.confetti || this.init(); // Maybe initialize
    this.resetConfettiState();
    this.setTimeoutLoop(
      ()=>{ if (!this.tickAll()) { return false; } },
      [this.animationDelay]);
  }

} // instance confettiSplosion

