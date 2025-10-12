import { EventEmitter } from "eventemitter3";

export class Command {
  execute() {
    throw new Error("Method not implemented.");
  }

  undo() {
    throw new Error("Method not implemented.");
  }
}

export class CommandAggregate extends Command {
  constructor() {
    super();
    this.commands = [];
  }

  add(command) {
    this.commands.push(command);
  }

  execute() {
    for (let command of this.commands) {
      command.execute();
    }
  }

  undo() {
    for (let command of this.commands) {
      command.undo();
    }
  }
}

export class CommandInvoker extends EventEmitter {
  constructor() {
    super();
    this.undoStack = [];
    this.redoStack = [];
    this.buildingAggregate = false;
  }

  add(command, forceAggregate) {
    if (forceAggregate && !this.buildingAggregate) {
      this.beginAggregate();
    }

    command.execute();
    this.redoStack = [];

    if (this.buildingAggregate) {
      this.nextUndoCommand.add(command);
    } else {
      this.undoStack.push(command);
    }

    this.emit("change");
  }

  beginAggregate() {
    this.undoStack.push(new CommandAggregate());
    this.buildingAggregate = true;
  }

  finalizeAggregate() {
    this.buildingAggregate = false;
  }

  undo() {
    this.finalizeAggregate();

    if (this.hasUndoCommands) {
      this.nextUndoCommand.undo();
      this.redoStack.push(this.undoStack.pop());
      this.emit("change");
    }
  }

  redo() {
    if (this.hasRedoCommands) {
      this.nextRedoCommand.execute();
      this.undoStack.push(this.redoStack.pop());
      this.emit("change");
    }
  }

  get hasUndoCommands() {
    return this.undoStack.length !== 0;
  }

  get hasRedoCommands() {
    return this.redoStack.length !== 0;
  }

  get nextUndoCommand() {
    return this.undoStack.at(-1);
  }

  get nextRedoCommand() {
    return this.redoStack.at(-1);
  }
}
