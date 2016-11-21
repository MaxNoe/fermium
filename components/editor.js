import React from "react";
import {spawn} from "child-process-promise";
import tmp from "tmp-promise";
import write from "fs-writefile-promise";
import path from "path";
import {remote, ipcRenderer} from 'electron';

var tex_options = ['--halt-on-error', '--interaction=nonstopmode']
var dvipng_options = ['-D', '1200', '-T', 'tight', '-o', 'formula.png']
var latex_template = {
  before : "\\documentclass{scrartcl}\\pagestyle{empty}\\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\n\\usepackage{mathtools}\\usepackage{lmodern}\\begin{document}\\begin{align*}",
  after: "\\end{align*}\\end{document}"
}


export default class Editor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      typingTimeout: 2000,
      formula: "a^2 + b^2 = c^2"
    };
  }
  
  componentWillUnmount(){
    if (typeof this.state.currentCleanupCallback !== 'undefined') {
      this.state.currentCleanupCallback();
    }
  }


  render() {
    return (
      <div>
        <div>
          <form>
            <textarea value={this.state.formula} onChange={this.handleChange.bind(this)}/>
          </form>
        </div>
        <div>
          <a href="#" id="drag" onDragStart={this.handleDrag.bind(this)}>
            <img src={this.state.image} alt="" style={{maxWidth: '100%', maxHeight: '100%'}}/>
          </a>
        </div>
      </div>
    );
  }

  handleDrag(event){
    event.preventDefault();
    ipcRenderer.send('ondragstart', this.state.image);
  }

  handleChange(event) {
    this.setState({formula: event.target.value});
    clearTimeout(this.state.typingTimer);
    this.state.typingTimer = setTimeout(this.doneTyping.bind(this), this.state.typingTimeout);
    console.log("Change");
  }

  doneTyping() {
    console.log(this.state.formula);
    this.run_latex();
  }

  run_latex() {
    tmp.dir()
    .then((dir) => {
      console.log(dir.path);
      this.state.directory = dir.path;
      var texfile = path.join(dir.path, 'formula.tex');
      var texcode = latex_template.before + this.state.formula + latex_template.after;
      return write(texfile, texcode);
    })
    .then((texfile) => {
      console.log(texfile);
      return spawn('latex', tex_options.concat([texfile]), {cwd: this.state.directory});
    })
    .then(() => {
      var dvifile = path.join(this.state.directory, 'formula.dvi');
      console.log(dvifile);
      return spawn("dvipng", dvipng_options.concat([dvifile]), {cwd: this.state.directory});
    })
    .then(() => {
      console.log("Updated image path");
      this.setState({image: path.join(this.state.directory, 'formula.png')});
    })
    .catch((err) => console.log('ERROR: ', err))
  }

}
