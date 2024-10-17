class Dropula {

  board; // The parent element whos children will be moved around
  moving = null; // The element currently being moved
  cursor = null; // A temporary "cursor" element (a copy of the current moving element)

  // Elements grouped into their static/visual onscreen rows for arbitrary row appending/prepending.
  rows = [[]];
  rowsYOffset = [];
  rowsHeights = [];

  isAnimate = true;

  callbacks = {};

  on (type, fn) {
    this.callbacks[type] = fn;
    return this;
  }

  animate (state) {
    this.isAnimate = state;
    return this;
  }

  hasCallback (type) {
    return this.callbacks[type];
  }
  callback (type, args) {
    return this.callbacks[type] && this.callbacks[type](...args);
  }

  pieces () {
    return [...this.board.el.children].filter( (el)=>!el.classList.contains("dropulacursor") );
  }

  dist = (a,b)=>Math.abs(a-b);

  setLoc (el, x, y, pos) {
    if (pos) { el.style.position = pos; }
    el.style.left = x + "px";
    el.style.top = y + "px";
  }

  appendSibling(el, sib) {
    el.insertAdjacentElement("afterend", sib);
  }

  /* Call fn periodically with args where args[0] specifies delay.
     Fn must return array with next call's arguments or undefined
     (to use initial args) to continue iteration.
     Iteration halts if fn returns false or an invalid args array.
  */
  setTimeoutLoop (fn, args) {
    const start = Date.now();
    let nextArgs = fn(...args);
    if (undefined === nextArgs) { nextArgs = args; }
    if (!Array.isArray(nextArgs) || !nextArgs.length) { return; }
    const delay = nextArgs[0] - Date.now() + start;
    setTimeout(this.setTimeoutLoop.bind(this, fn, nextArgs), delay<0?0:delay);
  }

  elementDetails (e) {
    const w = e.offsetWidth;
    const h = e.offsetHeight;
    const x = e.offsetLeft;
    const y = e.offsetTop;
    let row = undefined;
    this.rowsYOffset.find((yoffset,idx)=>{
      if (this.dist(y, yoffset) < this.rowsHeights[idx]/2) {
        row = idx;
        return true;
      }
    });
    return { w:w, h:h, x:x, y:y, row};
  }

  // Extract "mouse pointer" location from either touch or mouse event
  eventLocDetails (event) {
    const isTouch = event.changedTouches;
    const touch = isTouch ? event.changedTouches.item(0) : false;
    const x = touch ? touch.clientX : event.clientX;
    const y = touch ? touch.clientY : event.clientY;
    return { x:x, y:y, isTouch }
  }

  lockBoardPositions (piece) {
    if (this.board.style) { return; }

    // Lock board down
    const styleHeight = parseFloat(getComputedStyle(this.board.el).height);
    const styleWidth  = parseFloat(getComputedStyle(this.board.el).width);
    this.board.style = this.board.el.style; // Save board style/state
    this.board.el.style.position="relative";

    // Configure and record original board element (pieces) states
    this.board.pieces = this.pieces().map((el)=>{
      el.style.position = "relative";
      el.style.transition = "left 200ms ease-in, top 200ms ease-in";
      return [el, el.style, el.offsetLeft, el.offsetTop, el.offsetWidth];
    });

    // Collect the pieces into rows (except the moving piece)
    this.rows = []; // internal array of rows of pieces
    this.rowsYOffset = [];
    this.rowsHeights = [];
    let row;
    let rowTop = -1;
    let shift=0;
    this.board.pieces.map(([el, _style, left, top, width])=>{
      if (rowTop != top) {
        rowTop = top;
        this.rows.push(row=[]);
        this.rowsYOffset.push(top);
        this.rowsHeights.push(el.offsetHeight);
        shift=0;
      }
      if (el==piece) {
        shift = width/2;
        row.forEach( (_,i)=>row[i][1]+=shift );
      } else {
        row.push([el, left-shift, top, width]);
      }
    });

    // Lock container after locking children as setting this altered the width slightly causing wraping sometimes.
    this.board.el.style.height = styleHeight + "px";
    this.board.el.style.width  = styleWidth  + "px";

    this.rowsWidth = this.rows.map((row)=>row.reduce((r,[el,width])=>r+(el==piece?0:width),0)); // exclude moving

    this.board.scrollLoc = {
      x: this.board.el.getBoundingClientRect().left,
      y: this.board.el.getBoundingClientRect().top
    };
  }

  unlockBoardPositions () {
    if (!this.board.style) { return; }
    // Revert saved pieces DOM state.
    this.board.pieces.forEach(([piece, style])=>piece.style=style);
    // Revert board DOM state.
    this.board.el.style = this.board.style;
    this.board.style = null;
  }

  createMouseCursorFrom (el) {
    this.cursor = {el:el.cloneNode(true)};
    this.cursor = {el:el.cloneNode(true)};
    this.cursor.x = el.offsetLeft; //parseFloat(getComputedStyle(el).left);
    this.cursor.y = el.offsetTop;  //parseFloat(getComputedStyle(el).top);
    this.cursor.el.classList.add("dropulacursor");
    this.cursor.el.style.position = "absolute";
    this.cursor.el.style.transition = null;
    this.cursor.el.style.left = this.cursor.x + "px";
    this.cursor.el.style.top  = this.cursor.y + "px";
    this.cursor.slowAdjust = 0;
    //this.cursor.el.style.scale = .6;
    el.parentElement.appendChild(this.cursor.el); // arbitrarily place at end of board element

    this.moving = {el:el, style:el.style};
    this.moving.left = el.offsetLeft;
    this.moving.sibling = el.previousElementSibling;
    this.moving.el.style.opacity = 0.2;
    this.moving.origin = this.eventLocDetails(event); // Keep track of pointer start position for accurate cursor movement
  }

  resetCursorState () {
    if (this.cursor) {
      this.cursor.el.remove();
      this.cursor = null;
    }
    return this;
  }

  resetBoardPieceState () {
    if (this.moving) {
      this.moving.el.style = this.moving.style;
      this.moving = null;
    }
    return this.resetCursorState();
  }

  handlerPieceMotionBegin (piece) {
    // Ignore user if currenly in a winning state, new game not setup yet.

    this.callback('drag', [piece]);

    // Skip unmoveable elements.
    if (this.hasCallback("moves") && !this.callback("moves", [piece])) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.resetBoardPieceState(); // Reset drag/drop state in case of algorithm/UX hiccup
    this.lockBoardPositions(piece) // Temporarily lock pices into absolute positions.
    this.createMouseCursorFrom(piece); // The cursor becomes a copy of the piece being moved

    this.board.pieces.forEach( ([e, s, l, t, _])=>{
      this.setLoc(e, l, t, "absolute");
    });

    // Slowly move lifted element up (away from finger) for mobile event.
    this.setTimeoutLoop(
      ()=>{
        if (!this.moving.origin.isTouch || this.rowsHeights[0]/2 <= ++this.cursor.slowAdjust) {
          return false;
        }
        this.cursor.el.style.top = this.cursor.y - this.cursor.slowAdjust + "px";
      },
      [10]);

    return true;
  }

  handlerPieceMotionEnd () {
    if (!this.moving) { return false; }
    this.resetCursorState();
    this.appendSibling(this.moving.sibling, this.moving.el); // Officially set moved piece in DOM.
    const el = this.moving.el;
    this.resetBoardPieceState();
    this.unlockBoardPositions();
    this.callback('dragend', [el]);
    return true;
  }

  handlerPieceMotion () {
    if (!this.moving || !this.cursor) { return true; } // Skip if not in a "lifting/moving piece" state

    const pointer = this.eventLocDetails(event);
    const pointerDelta = {
      w: pointer.x - this.moving.origin.x,
      h: pointer.y - this.moving.origin.y - this.cursor.slowAdjust
    };
    const scrollDelta = { // zero unless the screen scroll for some reason
      x:this.board.scrollLoc.x - this.board.el.getBoundingClientRect().left,
      y:this.board.scrollLoc.y - this.board.el.getBoundingClientRect().top
    };

    //const screenScrollable = document.body.parentElement.scrollWidth - window.innerWidth; //  document.body.parentElement.clientWidth;
    //window.scrollTo(screenScrollable * pointer.x / this.board.el.scrollWidth, window.scrollY);

    // Update the "cursor" the user is moving around the screen
    this.setLoc(this.cursor.el, 
      this.cursor.x + pointerDelta.w + scrollDelta.x,
      this.cursor.y + pointerDelta.h + scrollDelta.y);

    const cursor = this.elementDetails(this.cursor.el);

    if (cursor.row===undefined) { return true; } // Skip if cursor not on a moveable area.

    let last = null;
    let targetSibling = false;
    this.rows.forEach( (row, rowIdx)=>{
      let isRow = rowIdx === cursor.row;
      let adj = isRow ? -this.moving.el.offsetWidth/2 : 0; // recenter row for moving piece insertion
      let right = this.moving.left;
      row.forEach( ([el, left, top, width])=>{
        if (!targetSibling && isRow && (this.cursor.el.offsetLeft < left || el.classList.contains("last-item")) && last) {
          this.setLoc(this.moving.el, left+adj, top);
          adj += this.moving.el.offsetWidth;
          targetSibling = last;
        }
        this.setLoc(el, left + adj, top);
        right = left+adj+width;
        last = el;
      });
      // Append moving piece to end.
      if (isRow && !targetSibling) {
        this.setLoc(this.moving.el, right, this.rowsYOffset[rowIdx]);
        targetSibling = last;
      }
    });

    // If piece moved (has a different sibling), perform movements and movement callback (trigger sound).
    if (targetSibling && targetSibling != this.moving.sibling) {
      this.moving.sibling = targetSibling;
      setTimeout(this.callback.bind(this, "shadow", [this.moving.el, undefined]), 200 );
    }

    return true;
  }

  setupHandlerPieceMotionBegin() {
    [...this.pieces()].forEach((piece)=>{
      piece.onmousedown = this.handlerPieceMotionBegin.bind(this, piece);
      piece.addEventListener("touchstart", piece.onmousedown);
    });
    return this;
  }

  setupHandlerPieceMotion() {
    document.body.onmousemove = this.handlerPieceMotion.bind(this);
    document.body.addEventListener("touchmove", document.body.onmousemove);
    return this;
  }

  setupHandlerPieceMotionEnd() {
    document.body.onmouseup = this.handlerPieceMotionEnd.bind(this);
    document.body.addEventListener("touchend", document.body.onmouseup);
    document.body.addEventListener("touchcancel", document.body.onmouseup);
    return this;
  }

  constructor (board) {
//    // rearrange rows if zoomed on mobile (work in progress)
//    visualViewport.onresize = ()=>{
//      console.log(event.currentTarget);
//      document.querySelector("#db").innerText = Math.trunc(event.currentTarget.width);
//      document.querySelector(".game-container").style.width = `${.9*Math.trunc(event.currentTarget.width)}px`;
//    ;}
    if (!board) return;
    this.board = {el:board};
    this
      .setupHandlerPieceMotionBegin()
      .setupHandlerPieceMotion()
      .setupHandlerPieceMotionEnd();
  }

} // class Dropula

