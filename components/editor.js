import React from "react";
import {spawn} from "child_process";
import tmp from "tmp";
import fs from "fs";
import path from "path";
import {remote, ipcRenderer} from 'electron';

var tex_options = ['--halt-on-error', '--interaction=nonstopmode']
var dvipng_options = ['-D', '1200', '-T', 'tight', '-o', 'formula.png']
var latex_template = {
  before : "\\documentclass{scrartcl}\\pagestyle{empty}\\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\n\\usepackage{mathtools}\\usepackage{lmodern}\\begin{document}\\begin{align*}",
  after: "\\end{align*}\\end{document}"
}
var last_cleanup;
remote.getCurrentWindow().on('close', () => {
  if (typeof last_cleanup !== 'undefined') last_cleanup();
})

export default class Editor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      typingTimeout: 2000,
      formula: "a^2 + b^2 = c^2"
    };
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
    this.call_latex(this.state.formula);
  }

  call_latex(formula){
    tmp.dir({unsafeCleanup: true}, (err, tmpdir, cleanupCallback) => {
      if (err) throw err;
      if (typeof last_cleanup !== 'undefined') last_cleanup();
      last_cleanup = cleanupCallback;
      console.log("Created tmp dir: ", tmpdir);

      var texfile = path.join(tmpdir, "formula.tex");
      var dvifile = texfile.replace('.tex', '.dvi');
      fs.writeFile(
        texfile,
        latex_template.before + formula + latex_template.after,
        (err) => {
          if (err) throw err;
          console.log("texfile written");
          var tex = spawn("latex", tex_options.concat([texfile]), {cwd: tmpdir});
          tex.stdout.on("data", (data) => {console.log(data.toString());});
          tex.stderr.on("data", (data) => {console.log(data.toString());});
          tex.on("exit", (err) => {
            console.log("latex done");
            var dvipng = spawn("dvipng", dvipng_options.concat([dvifile]), {cwd: tmpdir});
            dvipng.stdout.on("data", (data) => {console.log(data.toString());});
            dvipng.stderr.on("data", (data) => {console.log(data.toString());});
            dvipng.on("exit", (err) => {
              if (err) throw err;
              console.log("dvipng done");
              this.setState({image: dvifile.replace('.dvi', '.png')});
            });
          });
        }
      );
    });
  }
}
