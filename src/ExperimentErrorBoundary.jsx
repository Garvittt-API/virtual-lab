import React from "react";
export default class ExperimentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error("Laboratory component failed:", error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return this.props.scene ? (
        <div className="scene" role="alert">
          <p>
            3D workspace could not be initialized. The laboratory controls
            remain available.
          </p>
          <button onClick={() => this.setState({ failed: false })}>
            Retry 3D workspace
          </button>
        </div>
      ) : (
        <div className="simple-page" role="alert">
          <h1>Experiment could not be loaded</h1>
          <p>
            The laboratory encountered an error. Your saved sessions were not
            reset.
          </p>
          <button onClick={this.props.onReturn}>Return to Discover</button>
        </div>
      );
    return this.props.children;
  }
}
