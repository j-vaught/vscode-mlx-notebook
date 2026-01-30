function z_r = road_input_headon(t, V, t0, L_wb, bump_fn)
% ROAD_INPUT_HEADON  Road profile for head-on bump crossing.
%   Returns [zr1, zr2, zr3, zr4] at time t.
    x_front = V * (t - t0);
    x_rear  = V * (t - t0 - L_wb / V);
    z_f = bump_fn(x_front);
    z_re = bump_fn(x_rear);
    z_r = [z_f, z_f, z_re, z_re];
end
