class Dropula {
  board;

  pieceMoving = null;
  pieceMovingSibling = null;
  pieceMovingOrigin = {x:0, y:0};

  pieceCursor = null;
  pieceCursorOrigin = {x:0, y:0};

  slowAdjust = 0; // Used to slowly movie pice up above user's finger on mobile.

  rows = [[]];
  rowsOriginal = [[]];
  rowsYOffset = [];
  rowsHeights = [];
  rowsLeftPads = []

  pause = false;
  callbackMotionEnd = ()=>{};
  callbackQuasiMotion = ()=>{};

  pieces () {
    return [...board.children].filter( (el)=>!el.classList.contains("cursor") );
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
      && setTimeout(setTimeoutLoop.bind(0, fn, nextArgs), nextArgs[0]);
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

  // Extract "pointer" location from either touch or mouse event
  pointerDetails (event) {
    const isTouch = event.changedTouches;
    const touch = isTouch ? event.changedTouches.item(0) : false;
    const x = touch ? touch.clientX : event.x;
    const y = touch ? touch.clientY : event.y;
    return { x:x, y:y, isTouch }
  }

  dupRows (rows) { return rows.map((row)=>[...row]); }

  lockPiecesPositions () {
    [...this.pieces()]
      .map((piece)=>[piece, piece.offsetLeft+"px", piece.offsetTop+"px"])
      .forEach(([piece, left, top])=>{
         piece.style.position="absolute";
         piece.style.left = left;
         piece.style.top = top;
      });

    this.rows = []; // array of rows of pieces
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

  unlockPiecesPositions () {
    [...this.pieces()].forEach((piece)=>piece.style.position=null);
  }

  resetMovePieceSatate () {
    if (this.pieceMoving) {
      this.pieceMoving.classList.remove('shade');
      this.pieceMoving = null;
      this.pieceMovingSibling = null;
    }
    if (this.pieceCursor) {
      this.pieceCursor.remove();
      this.pieceCursor = null;
    }
    this.unlockPiecesPositions();
    return this;
  }

  createMouseCursorFrom (el) {
    this.pieceCursor = el.cloneNode(true);
    this.pieceCursorOrigin.x = el.offsetLeft;
    this.pieceCursorOrigin.y = el.offsetTop;
    this.pieceCursor.classList.add('cursor');
    this.pieceCursor.style.left = this.pieceCursorOrigin.x + "px";
    this.pieceCursor.style.top  = this.pieceCursorOrigin.y + "px";
    el.parentElement.appendChild(this.pieceCursor); // arbitrarily place at end of board element
  }

  handlerPieceMotionBegin (piece) {
    if (this.pause) { return; } // Ignore user if currenly in a winning state, new game not setup yet.

    event.preventDefault();
    event.stopPropagation();

    this.resetMovePieceSatate(); // Reset drag/drop state in case of algorithm/UX hiccup

    this.createMouseCursorFrom(piece); // The cursor becomes a copy of the piece being moved

    this.pieceMoving = piece;
    this.pieceMovingSibling = piece.nextElementSibling;
    this.pieceMoving.classList.add('shade'); // The piece being moved is re-styled
    this.pieceMovingOrigin = this.pointerDetails(event); // Keep track of pointer start position for accurate cursor movement

    // Temporarily lock pices into absolute positions.
    this.lockPiecesPositions()

    this.slowAdjust = 0;

    // Slowly move lifted element up (away from finger) for mobile event.
    this.setTimeoutLoop(
      ()=>{
        if (!this.pieceMovingOrigin.isTouch || this.rowsHeights[0]/2 <= ++this.slowAdjust) {
          return false;
        }
        this.pieceCursor.style.top = this.pieceCursorOrigin.y - this.slowAdjust + "px";
      },
      [10]);
    return true;
  }

  handlerPieceMotionEnd () {
    this.resetMovePieceSatate()
      .callbackMotionEnd();
    return true;
  }

  withinRows (y) {
    const last = this.rows.length-1;
    return this.rowsYOffset[0] - this.rowsHeights[0]/2 <= y
      && y <= this.rowsYOffset[last] + this.rowsHeights[last]/2;
  }

  handlerPieceMotion () {
    if (!this.pieceMoving) { return true; } // Skip if not in a "lifting/moving piece" state

    const pointer = this.pointerDetails(event);
    if (pointer.isTouch && this.slowAdjust < this.rowsHeights[0]/2) { ++this.slowAdjust; }
    const pointerDelta = { w:pointer.x-this.pieceMovingOrigin.x, h:pointer.y-this.pieceMovingOrigin.y-this.slowAdjust }

    // Move cursor
    this.pieceCursor.style.left = pointerDelta.w + this.pieceCursorOrigin.x + "px";
    this.pieceCursor.style.top  = pointerDelta.h + this.pieceCursorOrigin.y + "px";

    // Consider pointer's center location relative to the first child on this row.
    const cursor = this.elementDetails(this.pieceCursor);
    
    // Rearrange the pieces in the DOM, placing the lifted piece
    // in the best position relative to the mouse/cursor position.

    const cursorY = cursor.yc - this.pieceCursor.offsetHeight/2;

//let DBOUT="";

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
//DBOUT += `${isCursorOnRow} `;
        let pieceWidth = piece.offsetWidth;

        // Always place first piece (since it is an end piece which don't move)
        if (!piece.previousElementSibling) {
//DBOUT += `${rowsIdx}[${piece.innerText} ${widthSum} ${pieceWidth}] `;
          widthSum += pieceWidth;
          //this.board.insertBefore(piece, this.board.firstElementChild);
          ptr = piece;
          rowNew.push(ptr);
          return;
        }
        // Ignore  piece being moved.  Handled in subsequent logic in this method.
        if (this.withinRows(cursorY) && cursorIsOnAnyRow && piece==this.pieceMoving) { ptr=piece; return; }

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
        this.pieceMoving.style.left = loc[0] +"px";
        this.pieceMoving.style.top = loc[1] + "px";
 

//DBOUT += `${rowsIdx}[${this.pieceMoving.innerText} ${widthSum} ${this.pieceMoving.offsetWidth}] `;
          widthSum += this.pieceMoving.offsetWidth;
          if (!ptr) {
            row[0][0].insertAdjacentElement("beforebegin", this.pieceMoving);
          } else {
            ptr.insertAdjacentElement("afterend", this.pieceMoving);
          }
          movingPlaced = true;
          ptr = this.pieceMoving;
          rowNew.push(ptr);
        }

        if (!ptr) {
          row[0][0].insertAdjacentElement("beforebegin", piece);
        } else {
          ptr.insertAdjacentElement("afterend", piece);
        }
//DBOUT += `${rowsIdx}[${piece.innerText} ${widthSum} ${pieceWidth}] `;
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
        this.pieceMoving.style.left = leftPad + widthSum +"px";
        this.pieceMoving.style.top = this.rowsYOffset[rowsIdx] + "px";
        if (!ptr) {
          this.rows[rowsIdx+1][0].insertAdjacentElement("beforebegin", this.pieceMoving);
        } else {
          ptr.insertAdjacentElement("afterend", this.pieceMoving);
        }
//DBOUT += `[${this.pieceMoving.innerText} ${widthSum}] `;
      }

    });

//log(DBOUT);
//log(this.rows.map( (row)=>row.reduce( (r,p)=>r+" "+p.innerText, "" )));

    // Audio feed back but only if the piece moved (by way of noticing if the next sibling changed).
    if (this.pieceMoving.nextElementSibling != this.pieceMovingSibling) {
      this.pieceMovingSibling = this.pieceMoving.nextElementSibling;
      this.callbackQuasiMotion();
    }

    return true;
  }

  setupHandlerPieceMotionBegin() {
    [...this.pieces()].forEach( (piece, idx)=>{
      const isEndPiece = idx==0 || idx==this.pieces().length-1;
      piece.onmousedown = isEndPiece ? null : this.handlerPieceMotionBegin.bind(this, piece);
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
    this.board = board;
    this
      .setupHandlerPieceMotionBegin()
      .setupHandlerPieceMotion()
      .setupHandlerPieceMotionEnd();
  }

} // class Dropula

