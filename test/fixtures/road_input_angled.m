function z_r = road_input_angled(t, V, t0, alpha, a_vec, b_vec, bump_fn)
% ROAD_INPUT_ANGLED  Road profile for angled bump crossing.
%   Each wheel hits the bump at a different time based on its position.
    z_r = zeros(1, 4);
    for i = 1:4
        offset = (a_vec(i) * cos(alpha) + b_vec(i) * sin(alpha)) / V;
        x_i = V * (t - t0 - offset);
        z_r(i) = bump_fn(x_i);
    end
end
