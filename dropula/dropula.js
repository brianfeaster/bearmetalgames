class Dropula {
  board; // The parent element whos children will be moved around
  moving = null; // The element currently being moved
  cursor = null; // A temporary "cursor" element (a copy of the current moving element)

  // Elements grouped into their static/visual onscreen rows for arbitrary row appending/prepending.
  rows = [[]];
  rowsOriginal = [[]];
  rowsYOffset = [];
  rowsHeights = [];
  rowsLeftPads = []

  isBoardLocked = false;
  preLockedState = {};

  isPause = false;

  callbacks = {};

  on (type, fn) {
    this.callbacks[type] = fn;
    return this;
  }

  hasCallback (type) {
    return this.callbacks[type];
  }
  callback (type, args) {
    return this.callbacks[type] && this.callbacks[type](...args);
  }

  pieces () {
    return [...this.board.children].filter( (el)=>!el.classList.contains("dropulacursor") );
  }

  dist = (a,b)=>Math.abs(a-b);

  /* Call fn periodically with args where args[0] specifies delay.
     Fn must return array with next call's arguments or undefined
     (to use initial args) to continue iteration.
     Iteration halts if Fn doesn't return valid args array.
  */
  setTimeoutLoop (fn, args) {
    let nextArgs = fn(...args);
    if (undefined === nextArgs) { nextArgs = args; }
    Array.isArray(nextArgs) && nextArgs.length
      && setTimeout(this.setTimeoutLoop.bind(this, fn, nextArgs), nextArgs[0]);
  }

  elementDetails (e) {
    const w = e.offsetWidth;
    const h = e.offsetHeight;
    const wc = Math.floor(w/2);
    const hc = Math.floor(h/2);
    const x = e.offsetLeft;
    const y = e.offsetTop;
    return { w:w, h:h, wc:wc, hc:hc, x:x, y:y, xc:x+wc, yc:y+hc };
  }

  delta (a, b) { return { x:b.x-a.x, y:b.y-a.y }; }

  // Extract "mouse pointer" location from either touch or mouse event
  eventLocDetails (event) {
    const isTouch = event.changedTouches;
    const touch = isTouch ? event.changedTouches.item(0) : false;
    const x = touch ? touch.clientX : event.x;
    const y = touch ? touch.clientY : event.y;
    return { x:x, y:y, isTouch }
  }

  dupRows (rows) { return rows.map((row)=>[...row]); }

  lockBoardPositions () {
    if (this.isBoardLocked) { return; }
    this.isBoardLocked = true;

    // Lock board down
    const styleHeight = parseFloat(getComputedStyle(this.board).height);
    const styleWidth  = parseFloat(getComputedStyle(this.board).width);
    this.preLockedState.board = this.board.style; // Save board style/state
    this.board.style.position="relative";
    this.board.style.height = styleHeight + "px";
    this.board.style.width  = styleWidth  + "px";

    // Lock pieces down, saving original style/state.
    this.preLockedState.pieces = [...this.pieces()]
      .map((piece)=>{
        const style = piece.style;
        return [piece, style, piece.offsetTop, piece.offsetLeft];
      })
      .map(([piece, style, top, left])=>{
        piece.style.position = "absolute";
        piece.style.top = top + "px";
        piece.style.left = left + "px";
        return [piece, style];
    });

    this.rows = []; // internal array of rows of pieces
    let topOffset = -1;

    // Collect the pieces into rows
    this.pieces().map((el)=>{
      if (topOffset != el.offsetTop) {
        topOffset = el.offsetTop;
        this.rows.push([]);
      }
      this.rows[this.rows.length-1].push(el);
    });

    this.rowsOriginal = this.dupRows(this.rows);
    this.rowsYOffset = this.rows.map( (row)=>row[0].offsetTop );
    this.rowsHeights = this.rows.map( (row)=>row[0].offsetHeight );
    this.rowsLeftPads = this.rows.map( (row)=>row[0].offsetLeft );
  }

  unlockBoardPositions () {
    if (!this.isBoardLocked) { return; }
    this.isBoardLocked = false;
    // Revert saved pieces DOM state.
    this.preLockedState.pieces.forEach(([piece, style])=>piece.style=style);
    // Revert board DOM state.
    this.board.style = this.preLockedState.board;
  }

  createMouseCursorFrom (el) {
    this.cursor = {el:el.cloneNode(true)};
    this.cursor.x = parseFloat(getComputedStyle(el).left);
    this.cursor.y = parseFloat(getComputedStyle(el).top);
    this.cursor.el.classList.add("dropulacursor");
    this.cursor.el.style.position = "absolute";
    this.cursor.el.style.left = this.cursor.x + "px";
    this.cursor.el.style.top  = this.cursor.y + "px";
    this.cursor.slowAdjust = 0;
    el.parentElement.appendChild(this.cursor.el); // arbitrarily place at end of board element

    this.preLockedState.pieceMovingStyle = el.style;
    this.moving = {el:el};
    this.moving.sibling = el.nextElementSibling;
    this.moving.el.style.opacity = 0.2;
    this.moving.origin = this.eventLocDetails(event); // Keep track of pointer start position for accurate cursor movement
  }

  resetMovePieceState () {
    if (this.moving) {
      this.moving.el.style = this.preLockedState.pieceMovingStyle;
      this.moving = null;
    }
    if (this.cursor) {
      this.cursor.el.remove();
      this.cursor = null;
    }
    return this;
  }

  handlerPieceMotionBegin (piece) {
    // Ignore user if currenly in a winning state, new game not setup yet.
    if (this.isPause) { return; }

    // Skip unmoveable elements.
    if (this.hasCallback("moves") && !this.callback("moves", [piece])) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.resetMovePieceState(); // Reset drag/drop state in case of algorithm/UX hiccup
    this.lockBoardPositions() // Temporarily lock pices into absolute positions.
    this.createMouseCursorFrom(piece); // The cursor becomes a copy of the piece being moved

    // Slowly move lifted element up (away from finger) for mobile event.
    this.setTimeoutLoop(
      ()=>{
        if (!this.moving.origin.isTouch || this.rowsHeights[0]/2 <= ++this.cursor.slowAdjust) {
          return false;
        }
        this.cursor.el.style.top = this.cursor.y - this.cursor.slowAdjust + "px";
      },
      [10]);
    this.callback('drag', [this.moving.el]);
    return true;
  }

  handlerPieceMotionEnd () {
    if (!this.moving) { return false; }
    const el = this.moving.el;
    this.resetMovePieceState();
    this.unlockBoardPositions();
    this.callback('dragend', [el]);
    return true;
  }

  withinRows (y) {
    const last = this.rows.length-1;
    return this.rowsYOffset[0] - this.rowsHeights[0]/2 <= y
      && y <= this.rowsYOffset[last] + this.rowsHeights[last]/2;
  }

  handlerPieceMotion () {
    if (!this.moving) { return true; } // Skip if not in a "lifting/moving piece" state

    const pointer = this.eventLocDetails(event);
    const pointerDelta = { w:pointer.x-this.moving.origin.x, h:pointer.y-this.moving.origin.y-this.cursor.slowAdjust }

    // Move cursor
    this.cursor.el.style.left = pointerDelta.w + this.cursor.x + "px";
    this.cursor.el.style.top  = pointerDelta.h + this.cursor.y + "px";

    const cursor = this.elementDetails(this.cursor.el);

    // Rearrange the pieces in the DOM, placing the lifted piece
    // in the best position relative to the mouse/cursor position.

    const cursorY = cursor.yc - this.cursor.el.offsetHeight/2;

    (this.withinRows(cursorY) ? this.rows : this.rowsOriginal).forEach((row, rowsIdx)=>{
      let isCursorOnRow = this.dist(cursorY, this.rowsYOffset[rowsIdx]) < this.rowsHeights[rowsIdx]/2;
      const cursorIsOnAnyRow = this.rowsYOffset.some((y,idx)=>this.dist(cursorY, y)<this.rowsHeights[idx]/2);
      let ptr = null;
      let widthSum = 0;
      let movingPlaced = !isCursorOnRow;
      let rowNew = []; // keep track of new piece order for this row
      row = row.map((el)=>[el, el.offsetLeft]);
      const leftPad = this.rowsLeftPads[rowsIdx];

      row.forEach( ([piece, left])=>{
        let pieceWidth = piece.offsetWidth;

        // Always place first piece (since it is an end piece which don't move)
        if (!piece.previousElementSibling) {
          widthSum += pieceWidth;
          //this.board.insertBefore(piece, this.board.firstElementChild);
          ptr = piece;
          rowNew.push(ptr);
          return;
        }
        // Ignore  piece being moved.  Handled in subsequent logic in this method.
        if (this.withinRows(cursorY) && cursorIsOnAnyRow && piece==this.moving.el) { ptr=piece; return; }

        let cursorX = cursor.xc-row[0][0].offsetLeft;
        if (!movingPlaced && (cursorX < widthSum+pieceWidth || piece==this.pieces()[this.pieces().length-1])) {

          // TODO: Preliminary smooth motion of pieces.
          /*
          let x = this.pieceMoving.offsetLeft;
          let y = this.pieceMoving.offsetTop;
          sweepMapRange(20,
            [x,y],
            [10,10],
            [1,1],
            [leftPad+widthSum, this.rowsYOffset[rowsIdx]],
            (loc)=>{
              this.pieceMoving.style.left = loc[0] +"px";
              this.pieceMoving.style.top = loc[1] + "px";
            }
          );
          */
          let loc = [leftPad+widthSum, this.rowsYOffset[rowsIdx]];
          this.moving.el.style.left = loc[0] +"px";
          this.moving.el.style.top = loc[1] + "px";

          widthSum += this.moving.el.offsetWidth;
          if (!ptr) {
            row[0][0].insertAdjacentElement("beforebegin", this.moving.el);
          } else {
            ptr.insertAdjacentElement("afterend", this.moving.el);
          }
          movingPlaced = true;
          ptr = this.moving.el;
          rowNew.push(ptr);
        }

        if (!ptr) {
          row[0][0].insertAdjacentElement("beforebegin", piece);
        } else {
          ptr.insertAdjacentElement("afterend", piece);
        }

        rowNew.push(piece);
        piece.style.left = leftPad + widthSum + "px";
        piece.style.top = this.rowsYOffset[rowsIdx] + "px";
        widthSum += pieceWidth;
        ptr = piece;
      });

      // Update the rows state.
      this.rows[rowsIdx] = rowNew;

      // Everything was placed before the moving piece...so append it to row.
      if (!movingPlaced) {
        this.moving.el.style.left = leftPad + widthSum +"px";
        this.moving.el.style.top = this.rowsYOffset[rowsIdx] + "px";
        if (!ptr) {
          this.rows[rowsIdx+1][0].insertAdjacentElement("beforebegin", this.moving.el);
        } else {
          ptr.insertAdjacentElement("afterend", this.moving.el);
        }
      }

    });

    // Audio feed back but only if the piece moved (by way of noticing if the next sibling changed).
    if (this.moving.el.nextElementSibling != this.moving.sibling) {
      this.moving.sibling = this.moving.el.nextElementSibling;
      this.callback("shadow", [this.moving.el, undefined, undefined]);
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
    if (!board) return;
    this.board = board;
    this
      .setupHandlerPieceMotionBegin()
      .setupHandlerPieceMotion()
      .setupHandlerPieceMotionEnd();
  }

} // class Dropula

