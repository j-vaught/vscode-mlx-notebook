import sys
import json
import io
import base64
import os
import tempfile


def main():
    try:
        import matlab.engine
    except ImportError:
        error_msg = json.dumps({
            "error": "matlab.engine not found. Install with: cd <MATLAB>/extern/engines/python && python setup.py install"
        })
        print(error_msg)
        sys.stdout.flush()
        return

    try:
        eng = matlab.engine.start_matlab()
    except Exception as e:
        error_msg = json.dumps({"error": f"Failed to start MATLAB engine: {str(e)}"})
        print(error_msg)
        sys.stdout.flush()
        return

    # Signal readiness
    print(json.dumps({"status": "ready"}))
    sys.stdout.flush()

    # Main loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            cmd = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Handle quit command
        if cmd.get("action") == "quit":
            try:
                eng.quit()
            except Exception:
                pass
            break

        # Handle execute command
        if cmd.get("action") == "execute":
            code = cmd.get("code", "")
            out = io.StringIO()
            err = io.StringIO()
            figures = []

            try:
                # Create temp directory for figures
                tmpdir = tempfile.mkdtemp(prefix="mlx_fig_")

                # Wrap code to capture figures
                wrapper = f"""
set(0,'DefaultFigureVisible','off');
{code}
figs = findall(0,'Type','figure');
for i = 1:length(figs)
    saveas(figs(i), fullfile('{tmpdir}', sprintf('fig_%d.png', i)));
end
close all;
"""

                # Execute the wrapper
                eng.eval(wrapper, nargout=0, stdout=out, stderr=err)

                # Read and encode figures
                if os.path.exists(tmpdir):
                    for fname in sorted(os.listdir(tmpdir)):
                        if fname.endswith('.png'):
                            fpath = os.path.join(tmpdir, fname)
                            try:
                                with open(fpath, 'rb') as f:
                                    figures.append({"data": base64.b64encode(f.read()).decode()})
                                os.remove(fpath)
                            except Exception as fig_error:
                                err.write(f"Error reading figure {fname}: {str(fig_error)}\n")

                    try:
                        os.rmdir(tmpdir)
                    except Exception:
                        pass  # Directory not empty, that's ok

            except Exception as e:
                err.write(str(e))

            result = {
                "stdout": out.getvalue(),
                "stderr": err.getvalue(),
                "figures": figures if figures else None,
            }
            print(json.dumps(result))
            sys.stdout.flush()


if __name__ == "__main__":
    main()
